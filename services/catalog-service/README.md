# Catalog Service

Author: [@sojukrishna](https://github.com/sojukrishna)

Owns the **product catalog** (`catalog_db` in its own MongoDB).

## Responsibilities
- Manage products and stock levels.
- Serve product data over **REST** to the API Gateway / GraphQL.
- Serve a **gRPC** contract used by the Order Service to validate & price baskets.

## Interfaces
| Protocol | Port | Used by |
|----------|------|---------|
| REST     | 8001 | API Gateway, GraphQL composition |
| gRPC     | 50051 | Order Service (synchronous basket validation) |

## REST API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| GET | `/api/v1/products` | List products |
| GET | `/api/v1/products/{product_id}` | Get one product |
| POST | `/api/v1/products` | Create a product |
| GET | `/api/v2/products` | v2 — adds `currency` + `price_display` (non-breaking) |

## gRPC API (`catalog.proto`)
- `ValidateProducts(items[]) -> {all_available, items[], total}`
- `GetProduct(product_id) -> Product`

## Event Bus Integration (RabbitMQ)
- Exchange: `ecom.events` (topic, durable)
- Catalog queue: `catalog-service.queue` (durable)
- Binding keys: `catalog.*`
- Published event (current): `catalog.ProductCreated` on product creation

When `RABBITMQ_URL` is configured, catalog service declares the exchange/queue
on startup so the queue appears in RabbitMQ UI, and publishes catalog domain
events for downstream consumers.

## Data ownership
This is the **only** service that connects to `catalog_db`. Other services
obtain catalog data exclusively through the APIs above.

## Run standalone
```bash
docker build -t catalog-service .
docker run -p 8001:8001 -p 50051:50051 \
  -e MONGO_URI=mongodb://host.docker.internal:27017 catalog-service
```
----------------------------------------------------------------------------------------------------
