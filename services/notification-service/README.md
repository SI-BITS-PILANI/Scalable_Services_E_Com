# Notification Service

Author: [@Varun](https://github.com/Varun-srinivasa)

Owns the **customer notifications** (`notification_db` in its own MongoDB).

## Responsibilities
- Consume order and payment domain events from RabbitMQ.
- Store one notification document per event, keyed by `customer_id`.
- Expose a REST API for customers to list and acknowledge their notifications.
- Supply notification data to the GraphQL composition layer (`customerDashboard`).

## Interfaces
| Protocol | Port | Used by |
|----------|------|---------|
| REST     | 8004 | API Gateway, GraphQL composition |

## Event Subscriptions (RabbitMQ)

Exchange: `ecom.events` (topic, durable)  
Queue: `notification-service.queue` (durable)

| Routing Key | Event Type | Notification Message |
|---|---|---|
| `order.OrderCreated` | OrderCreated | "Your order `{order_id}` has been placed successfully." |
| `order.OrderCancelled` | OrderCancelled | "Your order `{order_id}` has been cancelled." |
| `order.OrderPaid` | OrderPaid | "Payment for your order `{order_id}` has been confirmed." |
| `payment.PaymentAuthorized` | PaymentAuthorized | "Payment for your order `{order_id}` has been authorized." |
| `payment.PaymentCaptured` | PaymentCaptured | "Payment for your order `{order_id}` has been captured. Your order is confirmed!" |
| `payment.PaymentFailed` | PaymentFailed | "Payment for your order `{order_id}` has failed. Please try again." |
| `payment.PaymentRefunded` | PaymentRefunded | "A refund for your order `{order_id}` has been processed." |

> The consumer retries with exponential backoff when RabbitMQ is unavailable.
> The REST service stays healthy even if the broker is down.

## REST API
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Liveness probe |
| GET | `/api/v1/notifications` | `X-Customer-Id` | List all notifications for the customer |
| GET | `/api/v1/notifications/{notification_id}` | `X-Customer-Id` | Get one notification |
| PUT | `/api/v1/notifications/{notification_id}/read` | `X-Customer-Id` | Mark a notification as read |

The `X-Customer-Id` header is injected by the API Gateway after JWT validation.
Customers can only see their own notifications.

## Example responses

```json
GET /api/v1/notifications
X-Customer-Id: c-001

[
  {
    "notification_id": "b2e4f1a0-...",
    "customer_id": "c-001",
    "event_type": "PaymentCaptured",
    "order_id": "ord-1001",
    "message": "Payment for your order ord-1001 has been captured. Your order is confirmed!",
    "read": false,
    "created_at": "2026-07-09T10:12:23.000Z"
  }
]
```

## Data ownership
This is the **only** service that connects to `notification_db`. Other services
obtain notification data exclusively through the APIs above.

MongoDB is used because notifications are naturally document-shaped, append-only,
and benefit from flexible schema evolution.

## Notification document (MongoDB)
```json
{
  "notification_id": "uuid-v4",
  "customer_id":     "c-001",
  "event_type":      "OrderCreated",
  "order_id":        "ord-1001",
  "message":         "Your order ord-1001 has been placed successfully.",
  "read":            false,
  "created_at":      "2026-07-09T10:00:00Z"
}
```

## Inter-Service Collaboration

| Collaborating Service | Why | Style | Sync/Async |
|---|---|---|---|
| API Gateway | Entry-point routing to notification APIs | REST | Synchronous |
| Order Service | Publishes `OrderCreated`, `OrderCancelled`, `OrderPaid` events | Events via RabbitMQ | Asynchronous |
| Payment Service | Publishes `PaymentAuthorized`, `PaymentCaptured`, `PaymentFailed` events | Events via RabbitMQ | Asynchronous |

## Run standalone
```bash
docker compose up --build
```

This starts:
- `notification-service` on port **8004**
- `notification-db` (MongoDB 7) on port **27017**
- `rabbitmq` (RabbitMQ 3.13) on ports **5672** / **15672**

RabbitMQ management UI: <http://localhost:15672> (guest / guest)

## Run tests
```bash
pip install -r requirements.txt
pytest
```

Tests use `mongomock-motor` (in-memory MongoDB) and disable the RabbitMQ
consumer, so no infrastructure is required to run them.
