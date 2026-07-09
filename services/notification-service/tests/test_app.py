"""Tests for the Notification Service HTTP API.

Uses mongomock-motor to provide an in-memory async MongoDB substitute so
tests run without a real database — the same pattern the order-service uses
with SQLite.  The RabbitMQ consumer is disabled via skip_consumer=True so
tests never need a broker.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

from app.consumer import _build_notification
from app.main import create_app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def build_client() -> TestClient:
    """Return a TestClient backed by an in-memory MongoDB mock."""
    mock_collection = AsyncMongoMockClient()["test_db"]["notifications"]
    app = create_app(collection=mock_collection, skip_consumer=True)
    return TestClient(app)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health_returns_ok():
    client = build_client()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "notification-service"


# ---------------------------------------------------------------------------
# List notifications
# ---------------------------------------------------------------------------


def test_list_notifications_empty_for_new_customer():
    client = build_client()
    response = client.get(
        "/api/v1/notifications",
        headers={"X-Customer-Id": "c-001"},
    )
    assert response.status_code == 200
    assert response.json() == []


def test_list_notifications_requires_customer_id_header():
    client = build_client()
    response = client.get("/api/v1/notifications")
    assert response.status_code == 422


def test_list_notifications_only_returns_own_notifications():
    mock_collection = AsyncMongoMockClient()["test_db"]["notifications"]
    app = create_app(collection=mock_collection, skip_consumer=True)
    client = TestClient(app)

    # Seed two notifications: one for c-001, one for c-002
    import asyncio

    async def _seed():
        await mock_collection.insert_many(
            [
                _build_notification("OrderCreated", {"order_id": "ord-1", "customer_id": "c-001"}),
                _build_notification("OrderCreated", {"order_id": "ord-2", "customer_id": "c-002"}),
            ]
        )

    asyncio.get_event_loop().run_until_complete(_seed())

    response = client.get(
        "/api/v1/notifications",
        headers={"X-Customer-Id": "c-001"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["customer_id"] == "c-001"
    assert data[0]["order_id"] == "ord-1"


# ---------------------------------------------------------------------------
# Get notification
# ---------------------------------------------------------------------------


def test_get_notification_not_found():
    client = build_client()
    response = client.get(
        "/api/v1/notifications/nonexistent-id",
        headers={"X-Customer-Id": "c-001"},
    )
    assert response.status_code == 404


def test_get_notification_returns_correct_record():
    mock_collection = AsyncMongoMockClient()["test_db"]["notifications"]
    app = create_app(collection=mock_collection, skip_consumer=True)
    client = TestClient(app)

    import asyncio

    notification = _build_notification(
        "OrderCancelled", {"order_id": "ord-99", "customer_id": "c-001"}
    )

    async def _seed():
        await mock_collection.insert_one(notification)

    asyncio.get_event_loop().run_until_complete(_seed())

    response = client.get(
        f"/api/v1/notifications/{notification['notification_id']}",
        headers={"X-Customer-Id": "c-001"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["notification_id"] == notification["notification_id"]
    assert data["event_type"] == "OrderCancelled"
    assert data["order_id"] == "ord-99"
    assert data["read"] is False


def test_get_notification_cannot_access_other_customers():
    mock_collection = AsyncMongoMockClient()["test_db"]["notifications"]
    app = create_app(collection=mock_collection, skip_consumer=True)
    client = TestClient(app)

    import asyncio

    notification = _build_notification(
        "OrderCreated", {"order_id": "ord-1", "customer_id": "c-001"}
    )

    async def _seed():
        await mock_collection.insert_one(notification)

    asyncio.get_event_loop().run_until_complete(_seed())

    # c-002 tries to access c-001's notification → 404
    response = client.get(
        f"/api/v1/notifications/{notification['notification_id']}",
        headers={"X-Customer-Id": "c-002"},
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Mark as read
# ---------------------------------------------------------------------------


def test_mark_as_read_not_found():
    client = build_client()
    response = client.put(
        "/api/v1/notifications/nonexistent-id/read",
        headers={"X-Customer-Id": "c-001"},
    )
    assert response.status_code == 404


def test_mark_as_read_flips_read_flag():
    mock_collection = AsyncMongoMockClient()["test_db"]["notifications"]
    app = create_app(collection=mock_collection, skip_consumer=True)
    client = TestClient(app)

    import asyncio

    notification = _build_notification(
        "PaymentCaptured", {"order_id": "ord-7", "customer_id": "c-001"}
    )
    assert notification["read"] is False

    async def _seed():
        await mock_collection.insert_one(notification)

    asyncio.get_event_loop().run_until_complete(_seed())

    response = client.put(
        f"/api/v1/notifications/{notification['notification_id']}/read",
        headers={"X-Customer-Id": "c-001"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["read"] is True
    assert data["notification_id"] == notification["notification_id"]


# ---------------------------------------------------------------------------
# Consumer unit tests — _build_notification helper
# ---------------------------------------------------------------------------


def test_build_notification_order_created():
    result = _build_notification(
        "OrderCreated", {"order_id": "ord-1", "customer_id": "c-001"}
    )
    assert result["event_type"] == "OrderCreated"
    assert result["order_id"] == "ord-1"
    assert result["customer_id"] == "c-001"
    assert "ord-1" in result["message"]
    assert result["read"] is False
    assert isinstance(result["created_at"], datetime)


def test_build_notification_payment_captured():
    result = _build_notification(
        "PaymentCaptured", {"order_id": "ord-2", "customer_id": "c-002"}
    )
    assert "confirmed" in result["message"].lower()


def test_build_notification_unknown_event_type():
    result = _build_notification(
        "SomeUnknownEvent", {"order_id": "ord-3", "customer_id": "c-003"}
    )
    assert result["event_type"] == "SomeUnknownEvent"
    assert "ord-3" in result["message"]


def test_build_notification_missing_order_id():
    result = _build_notification("OrderCreated", {"customer_id": "c-001"})
    assert result["order_id"] is None
    assert "N/A" in result["message"]
