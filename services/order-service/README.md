# Order Service

Owns the **order lifecycle** for the ShopFlow e-commerce platform.  
It is the single service responsible for creating, persisting, and managing orders.

---

## Service decomposition rationale

Order Service is decomposed as a **Business Capability** boundary.  
The _Order Management_ capability has distinct data, distinct rules (state machine, basket snapshot, cancellation policy), and distinct scaling needs from catalog browsing or payment processing.  
Keeping it separate enforces the **Single Responsibility Principle** at the service level and allows independent deployment, scaling, and fault isolation.

---

## Responsibilities

- Accept an order request, validate the basket against Catalog Service, and persist an immutable order snapshot (product names, quantities, and prices captured at checkout time so later catalog changes never corrupt order history).
- Manage order state transitions: `PENDING → CONFIRMED → PAID → CANCELLED`.
- Expose order history and order detail for the authenticated customer.
- Trigger a payment request to Payment Service after order creation.
- Publish domain events (`OrderCreated`, `OrderCancelled`) for downstream consumers such as Notification Service.

---

## Technology stack

| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | Python / FastAPI | Lightweight, async-ready, automatic OpenAPI docs |
| Database | PostgreSQL (`order_db`) | Strong consistency, ACID transactions, relational structure for order + line-items |
| ORM | SQLAlchemy 2.x | Typed models, migrations-friendly |
| gRPC client | grpcio 1.64 | Synchronous basket validation against Catalog Service |
| HTTP client | httpx | Synchronous payment request against Payment Service |

---

## Interfaces

| Protocol | Direction | Remote | Port | Purpose |
|----------|-----------|--------|------|---------|
| REST (inbound) | ← API Gateway | — | **8002** | Customer-facing order commands and queries |
| gRPC (outbound) | → Catalog Service | port 50051 | — | Synchronous basket validation before order is saved |
| REST (outbound) | → Payment Service | port 8003 | — | Synchronous payment request after order is saved |
| Events (outbound) | → broker/topic | — | — | `OrderCreated`, `OrderCancelled` for Notification and saga consumers |

---

## REST API

All authenticated routes expect the customer identity in the `X-Customer-Id` header (set by the API Gateway after JWT verification).

| Method | Path | Type | Description |
|--------|------|------|-------------|
| GET | `/health` | Query | Liveness probe |
| POST | `/api/v1/orders` | Command | Create a new order |
| GET | `/api/v1/orders` | Query | List orders for the authenticated customer |
| GET | `/api/v1/orders/{order_id}` | Query | Get a single order |
| POST | `/api/v1/orders/{order_id}/cancel` | Command | Cancel a pending or confirmed order |

### Create order — request body

```json
{
  "currency": "USD",
  "items": [
    { "product_id": "p-101", "quantity": 2 },
    { "product_id": "p-102", "quantity": 1 }
  ]
}
```

### Create order — response (201)

```json
{
  "order_id": "8f87be44-79b9-430b-bff2-f4484aed703a",
  "customer_id": "c-001",
  "status": "PENDING",
  "currency": "USD",
  "subtotal": "90.00",
  "total": "90.00",
  "items": [
    { "product_id": "p-101", "name": "Laptop Sleeve", "quantity": 2, "unit_price": "25.00", "line_total": "50.00" },
    { "product_id": "p-102", "name": "Wireless Mouse", "quantity": 1, "unit_price": "40.00", "line_total": "40.00" }
  ],
  "created_at": "2026-07-09T10:00:00Z",
  "updated_at": "2026-07-09T10:00:00Z"
}
```

---

## Order creation flow

```
Client → API Gateway → Order Service
                           │
                           ├─ gRPC ValidateProducts → Catalog Service
                           │   (checks stock, returns priced line items)
                           │
                           ├─ persist order snapshot → order_db (PostgreSQL)
                           │
                           ├─ POST /api/v1/payments → Payment Service
                           │
                           └─ publish OrderCreated event → broker
```

---

## Inter-service collaboration

| From | To | Protocol | Interaction | Sync / Async | Why |
|------|----|----------|-------------|--------------|-----|
| API Gateway | Order Service | REST | Command / Query | Sync | Single entry point; gateway handles JWT auth |
| Order Service | Catalog Service | gRPC | Query | Sync | Stock and pricing must be confirmed before saving the order |
| Order Service | Payment Service | REST | Command | Sync | Immediate checkout result needed for the order status |
| Order Service | Notification Service | Event | Event | Async | Decoupled; notification can fail without affecting order persistence |

**One-to-one vs one-to-many:** gRPC and REST calls are one-to-one. Event publication is one-to-many (any subscriber can consume `OrderCreated`).

**How coupling is reduced:** Catalog and Payment are accessed through *adapter ports* — swappable implementations controlled by environment variables. Tests use in-memory stubs; production uses real network adapters. Notification is fully decoupled via async events.

---

## Data ownership and database pattern

This is the **only** service that connects to `order_db`. Other services must use the REST API above to read order data.

**Pattern:** Database per Microservice  
**Why PostgreSQL:** Orders need ACID guarantees across the order header and line items. A relational model expresses the parent-child relationship cleanly and supports reliable order history queries.

**Stored data:**

| Table | Key fields |
|-------|-----------|
| `orders` | `order_id`, `customer_id`, `status`, `currency`, `subtotal`, `total`, `created_at`, `updated_at` |
| `order_items` | `product_id`, `product_name` (snapshot), `quantity`, `unit_price`, `line_total` |

Item names and prices are **snapshotted at checkout time** so future catalog changes never modify historical orders.

---

## Events published

| Event | When | Consumers |
|-------|------|-----------|
| `OrderCreated` | After order is persisted and payment is requested | Notification Service, saga consumers |
| `OrderCancelled` | After a PENDING/CONFIRMED order is cancelled | Notification Service |

---

## API versioning

- All HTTP endpoints are versioned under `/api/v1`.
- A **breaking change** (removing/renaming fields, changing validation rules) requires a new version path (`/api/v2`).
- **Non-breaking additions** (new optional fields, new endpoints) stay within the current version.
- The service release follows semantic versioning: **MAJOR** for breaking API changes, **MINOR** for backward-compatible additions, **PATCH** for bug fixes.

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `sqlite:///./order_service.db` | PostgreSQL connection string |
| `CATALOG_GRPC_HOST` | No | — | Hostname of Catalog Service; enables real gRPC validation when set |
| `CATALOG_GRPC_PORT` | No | `50051` | gRPC port of Catalog Service |
| `PAYMENT_SERVICE_URL` | No | — | Base URL of Payment Service; enables real HTTP payment when set |

When `CATALOG_GRPC_HOST` or `PAYMENT_SERVICE_URL` are unset the service falls back to stub adapters, allowing fully independent local development and testing.

---

## Running tests

```bash
pip install -r requirements.txt
pytest
```

Tests use an in-memory SQLite database and stub adapters for all external services — no running dependencies required.

---

## Run standalone (local)

```bash
# Start a local PostgreSQL container
docker run -d --name order-db \
  -e POSTGRES_DB=order_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:16-alpine

# Start the service
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/order_db \
  uvicorn app.main:app --port 8002 --reload
```

---

## Docker

```bash
# Build (also generates gRPC stubs from app/proto/catalog.proto)
docker build -t order-service .

# Run against a local PostgreSQL instance
docker run -p 8002:8002 \
  -e DATABASE_URL=postgresql+psycopg://postgres:postgres@host.docker.internal:5432/order_db \
  order-service
```

### With all integrations enabled (Docker Compose)

```yaml
order-service:
  environment:
    DATABASE_URL: postgresql+psycopg://postgres:postgres@order-db:5432/order_db
    CATALOG_GRPC_HOST: catalog-service
    CATALOG_GRPC_PORT: 50051
    PAYMENT_SERVICE_URL: http://payment-service:8003
```

---

## Project structure

```
order-service/
├── app/
│   ├── adapters.py      # CatalogPort, PaymentPort, and their real/stub implementations
│   ├── database.py      # SQLAlchemy engine and session factory
│   ├── main.py          # FastAPI app, OrderService, route handlers
│   ├── models.py        # OrderRecord, OrderItemRecord, OrderStatus
│   ├── schemas.py       # Pydantic request/response models
│   └── proto/
│       └── catalog.proto  # gRPC contract shared with Catalog Service
├── tests/
│   └── test_app.py      # API-level tests using TestClient and SQLite
├── Dockerfile
├── requirements.txt
└── pytest.ini
```