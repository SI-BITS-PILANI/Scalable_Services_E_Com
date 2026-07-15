from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
import json
from typing import List

from app.schemas import OrderItemRequest, ValidatedBasket, ValidatedItem


class CatalogPort:
    def validate_items(self, items: list[OrderItemRequest], currency: str) -> ValidatedBasket:
        raise NotImplementedError


class GrpcCatalogAdapter(CatalogPort):
    """Real adapter: calls the catalog-service ValidateProducts gRPC endpoint.

    The proto contract uses 'price' and 'subtotal' field names while
    order-service schemas use 'unit_price' and 'line_total'.  This adapter
    is the only place that knows about that mapping.

    Requires grpcio stubs to be generated from app/proto/catalog.proto before
    use (done automatically in the Docker build step).
    """

    def __init__(self, host: str, port: int = 50051) -> None:
        # Import generated stubs here so the module can be imported without
        # the stubs being present (e.g. during local test runs without Docker).
        try:
            import grpc
            try:
                from app.proto import catalog_pb2, catalog_pb2_grpc
            except ImportError:
                # Docker build may generate stubs at /app (top-level modules).
                import catalog_pb2  # type: ignore[import-not-found]
                import catalog_pb2_grpc  # type: ignore[import-not-found]

            self._grpc = grpc
            self._pb2 = catalog_pb2
            self._stub_cls = catalog_pb2_grpc.CatalogServiceStub
        except ImportError as exc:
            raise RuntimeError(
                "grpcio stubs are missing.  Run the Dockerfile build or "
                "'python -m grpc_tools.protoc' to generate them."
            ) from exc

        self._channel_address = f"{host}:{port}"

    def validate_items(self, items: list[OrderItemRequest], currency: str) -> ValidatedBasket:
        channel = self._grpc.insecure_channel(self._channel_address)
        try:
            stub = self._stub_cls(channel)
            request = self._pb2.ValidateProductsRequest(
                items=[
                    self._pb2.OrderItemInput(
                        product_id=item.product_id,
                        quantity=item.quantity,
                    )
                    for item in items
                ]
            )
            response = stub.ValidateProducts(request, timeout=5)

            if not response.all_available:
                unavailable = [
                    it.product_id for it in response.items if not it.available
                ]
                raise ValueError(
                    f"Some products are unavailable or out of stock: {unavailable}"
                )

            validated_items: List[ValidatedItem] = [
                ValidatedItem(
                    product_id=it.product_id,
                    name=it.name,
                    quantity=it.quantity,
                    unit_price=Decimal(str(it.price)),       # proto: price
                    line_total=Decimal(str(it.subtotal)),    # proto: subtotal
                )
                for it in response.items
            ]
            subtotal = sum((vi.line_total for vi in validated_items), Decimal("0"))
            return ValidatedBasket(
                items=validated_items,
                subtotal=subtotal,
                total=Decimal(str(response.total)),
                currency=currency,
            )
        finally:
            channel.close()


class PaymentPort:
    def request_payment(
        self,
        order_id: str,
        customer_id: str,
        amount: Decimal,
        currency: str,
        method: str = "CARD",
    ) -> PaymentResult:
        raise NotImplementedError


@dataclass
class PaymentResult:
    status: str
    payment_id: str | None = None
    transaction_ref: str | None = None


class HttpPaymentAdapter(PaymentPort):
    """Real adapter: calls the payment-service POST /api/v1/payments endpoint.

    Payment-service expects: orderId, customerId, amount, currency, method.
    A SUCCEEDED response means the payment was accepted synchronously.
    """

    def __init__(self, base_url: str) -> None:
        import httpx
        self._client = httpx.Client(base_url=base_url, timeout=10)

    def request_payment(
        self,
        order_id: str,
        customer_id: str,
        amount: Decimal,
        currency: str,
        method: str = "CARD",
    ) -> PaymentResult:
        payload = {
            "orderId": order_id,
            "customerId": customer_id,
            "amount": float(amount),
            "currency": currency.upper(),
            "method": method.upper(),
        }
        response = self._client.post("/api/v1/payments", json=payload)
        if response.status_code not in (200, 201):
            raise ValueError(
                f"Payment request failed: {response.status_code} {response.text}"
            )
        body = response.json() if response.content else {}
        return PaymentResult(
            status=str(body.get("status", "UNKNOWN")),
            payment_id=body.get("paymentId"),
            transaction_ref=body.get("transactionRef"),
        )


class StubPaymentAdapter(PaymentPort):
    """No-op stub used in local development and tests when payment-service is absent."""

    def request_payment(  # type: ignore[override]
        self,
        order_id: str,
        customer_id: str = "",
        amount: Decimal = Decimal("0"),
        currency: str = "USD",
        method: str = "CARD",
    ) -> PaymentResult:
        return PaymentResult(status="SKIPPED")


class EventPublisherPort:
    def publish(self, event_name: str, payload: dict[str, str]) -> None:
        raise NotImplementedError


class RabbitMqEventPublisher(EventPublisherPort):
    """RabbitMQ publisher for order domain events.

    Publishes to a durable topic exchange (default: ecom.events).
    Failures are intentionally swallowed so order persistence does not fail when
    the broker is temporarily unavailable.
    """

    def __init__(self, amqp_url: str, exchange: str = "ecom.events") -> None:
        self.amqp_url = amqp_url
        self.exchange = exchange

    def publish(self, event_name: str, payload: dict[str, str]) -> None:
        try:
            import pika

            connection = pika.BlockingConnection(pika.URLParameters(self.amqp_url))
            channel = connection.channel()
            channel.exchange_declare(
                exchange=self.exchange,
                exchange_type="topic",
                durable=True,
            )

            body = json.dumps(
                {
                    "event_type": event_name,
                    "order_id": payload.get("order_id"),
                    "customer_id": payload.get("customer_id"),
                }
            )
            channel.basic_publish(
                exchange=self.exchange,
                routing_key=event_name,
                body=body,
                properties=pika.BasicProperties(delivery_mode=2),
            )
            connection.close()
        except Exception as exc:
            print(f"[order-service] event publish skipped for {event_name}: {exc}")


PRICE_BOOK: dict[str, tuple[str, Decimal]] = {
    "p-101": ("Laptop Sleeve", Decimal("25.00")),
    "p-102": ("Wireless Mouse", Decimal("40.00")),
    "p-103": ("Mechanical Keyboard", Decimal("85.00")),
}


class StubCatalogAdapter(CatalogPort):
    def validate_items(self, items: list[OrderItemRequest], currency: str) -> ValidatedBasket:
        validated_items: list[ValidatedItem] = []
        subtotal = Decimal("0.00")

        for item in items:
            name, unit_price = PRICE_BOOK.get(
                item.product_id,
                (f"Product {item.product_id}", Decimal("15.00")),
            )
            line_total = unit_price * item.quantity
            subtotal += line_total
            validated_items.append(
                ValidatedItem(
                    product_id=item.product_id,
                    name=name,
                    quantity=item.quantity,
                    unit_price=unit_price,
                    line_total=line_total,
                )
            )

        return ValidatedBasket(
            items=validated_items,
            subtotal=subtotal,
            total=subtotal,
            currency=currency,
        )


@dataclass
class InMemoryEventPublisher(EventPublisherPort):
    events: list[tuple[str, dict[str, str]]] = field(default_factory=list)

    def publish(self, event_name: str, payload: dict[str, str]) -> None:
        self.events.append((event_name, payload))
