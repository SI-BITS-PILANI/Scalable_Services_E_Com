# Order Service

Owns the **order lifecycle** (`order_db` in its own PostgreSQL database).

## Responsibilities
- Create orders from validated basket items.
- Persist order snapshots with product name, quantity, price, and totals at checkout time.
- Expose customer order history and order details.
- Manage order state transitions such as `PENDING`, `CONFIRMED`, `PAID`, and `CANCELLED`.
- Publish order events for downstream services such as Notification.

## Interfaces
| Protocol | Port | Used by |
|----------|------|---------|
| REST     | 8002 | API Gateway, GraphQL composition |
| gRPC     | 50051 (catalog) | Catalog Service (synchronous basket validation) |
| Events   | broker/topic | Notification Service, future subscribers |

## REST API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| POST | `/api/v1/orders` | Create an order |
| GET | `/api/v1/orders` | List orders for the authenticated customer |
| GET | `/api/v1/orders/{order_id}` | Get one order |
| POST | `/api/v1/orders/{order_id}/cancel` | Cancel a pending order |

## Events
- `OrderCreated`
- `OrderPaid`
- `OrderCancelled`

## Data ownership
This is the **only** service that connects to `order_db`. Other services obtain
order information only through the APIs above.

The service stores:
- order id and customer id,
- order status,
- currency, subtotal, and total,
- item snapshots including product id, name, quantity, and unit price.

This follows the **Database per Microservice** pattern. PostgreSQL is used here
because orders require strong consistency, relational structure, and reliable
history tracking.

## Versioning
- HTTP endpoints are versioned under `/api/v1`.
- Breaking changes require a new major version.
- Non-breaking additions can be released within the current version.

## Run standalone
```bash
docker build -t order-service .
docker run -p 8002:8002 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/order_db order-service
```