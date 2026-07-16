from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"


class OrderItemRequest(BaseModel):
    product_id: str = Field(min_length=1)
    quantity: int = Field(gt=0)


class CreateOrderRequest(BaseModel):
    items: list[OrderItemRequest] = Field(min_length=1)
    currency: str = Field(default="USD", min_length=3, max_length=8)
    method: str = Field(default="CARD", min_length=3, max_length=20)


class OrderItemResponse(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class OrderResponse(BaseModel):
    order_id: str
    customer_id: str
    status: str
    currency: str
    subtotal: Decimal
    total: Decimal
    items: list[OrderItemResponse]
    created_at: datetime
    updated_at: datetime


class ValidatedItem(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class ValidatedBasket(BaseModel):
    items: list[ValidatedItem]
    subtotal: Decimal
    total: Decimal
    currency: str
