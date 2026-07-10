from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'order-service.db'}"
    return TestClient(create_app(database_url=database_url))


def test_health_endpoint(tmp_path: Path) -> None:
    client = build_client(tmp_path)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_list_get_and_cancel_order(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = {"X-Customer-Id": "c-001"}

    create_response = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "currency": "USD",
            "items": [
                {"product_id": "p-101", "quantity": 2},
                {"product_id": "p-102", "quantity": 1},
            ],
        },
    )

    assert create_response.status_code == 201
    created_order = create_response.json()
    assert created_order["status"] == "PENDING"
    assert created_order["subtotal"] == "90.00"
    assert len(created_order["items"]) == 2

    list_response = client.get("/api/v1/orders", headers=headers)
    assert list_response.status_code == 200
    orders = list_response.json()
    assert len(orders) == 1
    assert orders[0]["order_id"] == created_order["order_id"]

    get_response = client.get(f"/api/v1/orders/{created_order['order_id']}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["customer_id"] == "c-001"

    cancel_response = client.post(f"/api/v1/orders/{created_order['order_id']}/cancel", headers=headers)
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "CANCELLED"


def test_order_events_use_notification_routing_keys(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = {"X-Customer-Id": "c-001"}

    create_response = client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "currency": "USD",
            "items": [{"product_id": "p-101", "quantity": 1}],
        },
    )
    assert create_response.status_code == 201

    order_id = create_response.json()["order_id"]
    cancel_response = client.post(f"/api/v1/orders/{order_id}/cancel", headers=headers)
    assert cancel_response.status_code == 200

    events = client.app.state.order_service.event_publisher.events
    event_names = [name for name, _ in events]
    assert "order.OrderCreated" in event_names
    assert "order.OrderCancelled" in event_names


def test_missing_customer_header_is_rejected(tmp_path: Path) -> None:
    client = build_client(tmp_path)

    response = client.get("/api/v1/orders")

    assert response.status_code == 400
    assert response.json()["detail"] == "X-Customer-Id header is required."
