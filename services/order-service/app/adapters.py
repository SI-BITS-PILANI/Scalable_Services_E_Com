from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.schemas import OrderItemRequest, ValidatedBasket, ValidatedItem


class CatalogPort:
    def validate_items(self, items: list[OrderItemRequest], currency: str) -> ValidatedBasket:
        raise NotImplementedError


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
