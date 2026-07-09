"""Notification Service — FastAPI application.

Responsibilities:
  * Consume order/payment domain events from RabbitMQ and persist them as
    customer-facing notifications in MongoDB.
  * Expose a REST API so customers (via the API Gateway) can list and
    acknowledge their notifications.

Exposes REST on port 8004 (configurable via NOTIFICATION_REST_PORT).
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import ReturnDocument

from app.config import settings
from app.consumer import _build_notification, start_consumer
from app.database import get_notifications_collection
from app.schemas import HealthResponse, NotificationResponse, SeedNotificationRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _serialize(doc: dict) -> dict:
    """Convert a raw MongoDB document to a serialisable dict."""
    return {
        "notification_id": doc["notification_id"],
        "customer_id": doc["customer_id"],
        "event_type": doc["event_type"],
        "order_id": doc.get("order_id"),
        "message": doc["message"],
        "read": doc.get("read", False),
        "created_at": doc["created_at"],
    }


def create_app(
    mongo_uri: Optional[str] = None,
    collection: Optional[AsyncIOMotorCollection] = None,
    skip_consumer: bool = False,
) -> FastAPI:
    """Application factory.

    Args:
        mongo_uri:      Override MongoDB URI (useful in tests to point at a
                        mock client without touching global settings).
        collection:     Inject a pre-built Motor collection (used by tests to
                        pass a mongomock-motor collection directly).
        skip_consumer:  When True the RabbitMQ consumer task is not started.
                        Set this in tests to avoid a real broker dependency.
    """
    if collection is None:
        collection = get_notifications_collection(
            mongo_uri or settings.mongo_uri,
            settings.db_name,
        )

    consumer_task: Optional[asyncio.Task] = None

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        nonlocal consumer_task
        if not skip_consumer:
            consumer_task = asyncio.create_task(
                start_consumer(settings.rabbitmq_url, collection)
            )
            logger.info("Notification consumer task started.")
        yield
        if consumer_task and not consumer_task.done():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass

    app = FastAPI(
        title="Notification Service",
        version="1.0.0",
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    @app.get("/health", response_model=HealthResponse)
    async def health():
        return HealthResponse()

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------

    @app.get(
        "/api/v1/notifications",
        response_model=list[NotificationResponse],
        summary="List notifications for the authenticated customer",
    )
    async def list_notifications(
        x_customer_id: str = Header(
            ...,
            description="Customer ID injected by the API Gateway after JWT validation.",
        ),
    ):
        docs = (
            await collection.find({"customer_id": x_customer_id})
            .sort("created_at", -1)
            .to_list(100)
        )
        return [_serialize(doc) for doc in docs]

    @app.get(
        "/api/v1/notifications/{notification_id}",
        response_model=NotificationResponse,
        summary="Get a single notification",
    )
    async def get_notification(
        notification_id: str,
        x_customer_id: str = Header(...),
    ):
        doc = await collection.find_one(
            {"notification_id": notification_id, "customer_id": x_customer_id}
        )
        if doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found.",
            )
        return _serialize(doc)

    @app.put(
        "/api/v1/notifications/{notification_id}/read",
        response_model=NotificationResponse,
        summary="Mark a notification as read",
    )
    async def mark_as_read(
        notification_id: str,
        x_customer_id: str = Header(...),
    ):
        doc = await collection.find_one_and_update(
            {"notification_id": notification_id, "customer_id": x_customer_id},
            {"$set": {"read": True}},
            return_document=ReturnDocument.AFTER,
        )
        if doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found.",
            )
        return _serialize(doc)

    # ------------------------------------------------------------------
    # Seed (dev/test only) — simulate an event without a real broker
    # ------------------------------------------------------------------

    @app.post(
        "/api/v1/notifications/seed",
        response_model=NotificationResponse,
        status_code=201,
        summary="[Dev] Directly create a notification to test without RabbitMQ",
    )
    async def seed_notification(request: SeedNotificationRequest):
        notification = _build_notification(
            request.event_type,
            {"order_id": request.order_id, "customer_id": request.customer_id},
        )
        await collection.insert_one(notification)
        return _serialize(notification)

    return app


# Module-level app instance used by uvicorn in production:
#   uvicorn app.main:app --host 0.0.0.0 --port 8004
app = create_app()
