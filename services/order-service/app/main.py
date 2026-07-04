from __future__ import annotations

from contextlib import contextmanager
from decimal import Decimal
from typing import Iterator, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, sessionmaker

from app.adapters import InMemoryEventPublisher, StubCatalogAdapter, StubPaymentAdapter
from app.database import create_session_factory
from app.models import Base, OrderItemRecord, OrderRecord, OrderStatus
from app.schemas import CreateOrderRequest, HealthResponse, OrderItemResponse, OrderResponse


class OrderService:
    def __init__(
        self,
        session_factory: sessionmaker,
        catalog_adapter: StubCatalogAdapter,
        payment_adapter: StubPaymentAdapter,
        event_publisher: InMemoryEventPublisher,
    ) -> None:
        self.session_factory = session_factory
        self.catalog_adapter = catalog_adapter
        self.payment_adapter = payment_adapter
        self.event_publisher = event_publisher

    @contextmanager
    def session_scope(self) -> Iterator[Session]:
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def create_order(self, customer_id: str, request: CreateOrderRequest) -> OrderResponse:
        validated_basket = self.catalog_adapter.validate_items(request.items, request.currency)

        with self.session_scope() as session:
            order = OrderRecord(
                order_id=str(uuid4()),
                customer_id=customer_id,
                status=OrderStatus.PENDING.value,
                currency=validated_basket.currency,
                subtotal=validated_basket.subtotal,
                total=validated_basket.total,
                items=[
                    OrderItemRecord(
                        product_id=item.product_id,
                        product_name=item.name,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        line_total=item.line_total,
                    )
                    for item in validated_basket.items
                ],
            )
            session.add(order)
            session.flush()
            session.refresh(order)

            self.payment_adapter.request_payment(order.order_id, Decimal(order.total), order.currency)
            self.event_publisher.publish(
                "OrderCreated",
                {"order_id": order.order_id, "customer_id": customer_id},
            )
            return self._to_response(order)

    def list_orders(self, customer_id: str) -> list[OrderResponse]:
        with self.session_scope() as session:
            query = (
                select(OrderRecord)
                .options(joinedload(OrderRecord.items))
                .where(OrderRecord.customer_id == customer_id)
                .order_by(OrderRecord.created_at.desc())
            )
            orders = session.execute(query).scalars().unique().all()
            return [self._to_response(order) for order in orders]

    def get_order(self, customer_id: str, order_id: str) -> OrderResponse:
        with self.session_scope() as session:
            order = self._find_order(session, customer_id, order_id)
            return self._to_response(order)

    def cancel_order(self, customer_id: str, order_id: str) -> OrderResponse:
        with self.session_scope() as session:
            order = self._find_order(session, customer_id, order_id)
            if order.status not in {OrderStatus.PENDING.value, OrderStatus.CONFIRMED.value}:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Only pending or confirmed orders can be cancelled.",
                )

            order.status = OrderStatus.CANCELLED.value
            session.add(order)
            session.flush()
            session.refresh(order)

            self.event_publisher.publish(
                "OrderCancelled",
                {"order_id": order.order_id, "customer_id": customer_id},
            )
            return self._to_response(order)

    def _find_order(self, session: Session, customer_id: str, order_id: str) -> OrderRecord:
        query = (
            select(OrderRecord)
            .options(joinedload(OrderRecord.items))
            .where(OrderRecord.customer_id == customer_id, OrderRecord.order_id == order_id)
        )
        order = session.execute(query).scalars().unique().first()
        if order is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        return order

    def _to_response(self, order: OrderRecord) -> OrderResponse:
        return OrderResponse(
            order_id=order.order_id,
            customer_id=order.customer_id,
            status=order.status,
            currency=order.currency,
            subtotal=Decimal(order.subtotal),
            total=Decimal(order.total),
            items=[
                OrderItemResponse(
                    product_id=item.product_id,
                    name=item.product_name,
                    quantity=item.quantity,
                    unit_price=Decimal(item.unit_price),
                    line_total=Decimal(item.line_total),
                )
                for item in order.items
            ],
            created_at=order.created_at,
            updated_at=order.updated_at,
        )


def get_customer_id(x_customer_id: Optional[str] = Header(default=None)) -> str:
    if not x_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Customer-Id header is required.",
        )
    return x_customer_id


def create_app(database_url: Optional[str] = None) -> FastAPI:
    session_factory = create_session_factory(database_url)
    Base.metadata.create_all(bind=session_factory.kw["bind"])

    app = FastAPI(title="Order Service", version="1.0.0")
    app.state.order_service = OrderService(
        session_factory=session_factory,
        catalog_adapter=StubCatalogAdapter(),
        payment_adapter=StubPaymentAdapter(),
        event_publisher=InMemoryEventPublisher(),
    )

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse()

    @app.post("/api/v1/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
    def create_order(request: CreateOrderRequest, customer_id: str = Depends(get_customer_id)) -> OrderResponse:
        return app.state.order_service.create_order(customer_id, request)

    @app.get("/api/v1/orders", response_model=list[OrderResponse])
    def list_orders(customer_id: str = Depends(get_customer_id)) -> list[OrderResponse]:
        return app.state.order_service.list_orders(customer_id)

    @app.get("/api/v1/orders/{order_id}", response_model=OrderResponse)
    def get_order(order_id: str, customer_id: str = Depends(get_customer_id)) -> OrderResponse:
        return app.state.order_service.get_order(customer_id, order_id)

    @app.post("/api/v1/orders/{order_id}/cancel", response_model=OrderResponse)
    def cancel_order(order_id: str, customer_id: str = Depends(get_customer_id)) -> OrderResponse:
        return app.state.order_service.cancel_order(customer_id, order_id)

    return app


app = create_app()
