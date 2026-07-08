from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
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
            from app.proto import catalog_pb2, catalog_pb2_grpc

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
    def request_payment(self, order_id: str, amount: Decimal, currency: str) -> None:
        raise NotImplementedError


class EventPublisherPort:
    def publish(self, event_name: str, payload: dict[str, str]) -> None:
        raise NotImplementedError


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


class StubPaymentAdapter(PaymentPort):
    def request_payment(self, order_id: str, amount: Decimal, currency: str) -> None:
        return None


@dataclass
class InMemoryEventPublisher(EventPublisherPort):
    events: list[tuple[str, dict[str, str]]] = field(default_factory=list)

    def publish(self, event_name: str, payload: dict[str, str]) -> None:
        self.events.append((event_name, payload))
