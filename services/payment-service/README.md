# Payment Service

Payment Service is a Node.js (JavaScript ES Modules) microservice for the e-commerce application.
It owns payment processing and payment status tracking for orders.

## 1) Service Boundary and Responsibility

### Domain
- Application domain: E-commerce
- Decomposition style: Business Capability (Payments capability)

### Why this is a separate microservice
- Payments have strict business and security rules that should not be mixed with order/catalog logic.
- Payment reliability and audit requirements are different from catalog and order workflows.
- Payment can scale independently during checkout spikes.

### Main responsibilities
- Create a payment intent/request for an order.
- Validate payment request and required metadata.
- Authorize/capture payment through a provider adapter (mock or real gateway).
- Persist payment transaction and status history.
- Expose payment status APIs to other services through gateway.
- Publish payment events for saga progression.

## 2) API Design (Current: v1)

Base path:
- `/api/v1/payments`

Auth:
- Requests should come through API Gateway with JWT (customer/admin as needed).

### REST endpoints

| Method | Path | Purpose | Interaction Type |
|---|---|---|---|
| GET | `/health` | Liveness/readiness check | Query |
| POST | `/api/v1/payments` | Create and process a payment for an order | Command |
| GET | `/api/v1/payments/{paymentId}` | Get payment details by payment ID | Query |
| GET | `/api/v1/payments/order/{orderId}` | Get payment by order ID | Query |
| POST | `/api/v1/payments/{paymentId}/refund` | Refund a successful payment (optional flow) | Command |

### Example request/response

Create payment:

```http
POST /api/v1/payments
Content-Type: application/json
Idempotency-Key: 5f8b0f2f-5c53-4b5f-9f20-2c6b9f4fd3b9

{
  "orderId": "ord_1001",
  "customerId": "cust_2001",
  "amount": 1499.00,
  "currency": "INR",
  "method": "CARD",
  "metadata": {
    "source": "checkout"
  }
}
```

```json
{
  "paymentId": "pay_8b8a6f2",
  "orderId": "ord_1001",
  "status": "SUCCEEDED",
  "amount": 1499.00,
  "currency": "INR",
  "transactionRef": "txn_9918273",
  "createdAt": "2026-07-07T10:12:23.000Z"
}
```

Error example:

```json
{
  "error": {
    "code": "PAYMENT_DECLINED",
    "message": "Payment authorization failed"
  }
}
```

## 3) Inter-Service Collaboration

| Collaborating Service | Why it collaborates | Style | One-to-One / One-to-Many | Sync / Async |
|---|---|---|---|---|
| API Gateway | Entry point routing to payment APIs | REST | One-to-One | Synchronous |
| Order Service | Receives payment result and updates order state | Events | One-to-Many via broker | Asynchronous |
| Notification Service | Sends customer notification after payment result | Events | One-to-Many via broker | Asynchronous |

### Command, Query, Event mapping
- Command: `POST /api/v1/payments` (initiate payment)
- Query: `GET /api/v1/payments/{paymentId}`
- Events published:
  - `PaymentAuthorized`
  - `PaymentCaptured`
  - `PaymentFailed`
  - `PaymentRefunded` (if refund flow is implemented)

## 4) Saga Pattern (Choreography-Based)

This service follows a choreography-based Saga using complimentary events.
No central orchestrator is required.

### Happy path
1. Order Service publishes `OrderCreated`.
2. Payment Service consumes `OrderCreated` and attempts payment.
3. Payment Service publishes `PaymentCaptured`.
4. Order Service consumes `PaymentCaptured` and marks order as `PAID`.
5. Notification Service consumes payment/order events and notifies the customer.

### Failure/compensation path
1. Payment Service fails authorization/capture.
2. Payment Service publishes `PaymentFailed`.
3. Order Service consumes `PaymentFailed` and transitions order to `CANCELLED` (or `PAYMENT_FAILED`).
4. Notification Service informs customer about failure.

### Why choreography is suitable here
- Loose coupling: services react to events without direct hard dependency.
- Better fault isolation: temporary service outage does not fully block the flow.
- Easy extensibility: add subscribers (analytics, fraud checks) without changing producer API.

## 5) Database Strategy and Data Ownership

Pattern:
- Database per Microservice

Recommended database for Payment Service:
- PostgreSQL (ACID transactions, strong consistency, reliable audit trail)

Seed data decision:
- Seed data is optional for correctness because payment rows are transactional.
- We include a minimal demo seed so the team can show database state, query screenshots, and Swagger/demo flow before all POST APIs are implemented.
- The seed runs only on first database creation; after that, the persisted volume keeps the existing data.

Suggested owned entities:
- `payments` (paymentId, orderId, customerId, amount, currency, method, status, providerRef, createdAt, updatedAt)
- `payment_events` (eventId, paymentId, type, payload, publishedAt)
- `idempotency_keys` (key, requestHash, responseSnapshot, createdAt)

Only Payment Service accesses its payment DB directly.
Other services must use APIs/events.

## 6) API Versioning Strategy

URI versioning:
- Current version: `/api/v1/...`

Breaking vs non-breaking:
- Breaking change examples:
  - Renaming/removing fields in response.
  - Changing endpoint path semantics.
  - Changing validation rules that reject old valid requests.
- Non-breaking change examples:
  - Adding optional response fields.
  - Adding new optional query params.

Semantic versioning policy (service release version):
- MAJOR: incompatible API changes (e.g., v1 -> v2)
- MINOR: backward-compatible functionality additions
- PATCH: backward-compatible bug fixes

Recommended tags:
- `v1.0.0` initial stable release
- `v1.1.0` optional fields/new endpoint
- `v1.1.1` bug fix

## 7) Docker Containerization

This service is intended to run as an independent container.

### Expected Node.js setup
- JavaScript with ES Modules (`"type": "module"` in package.json)
- Entry file example: `src/server.js`
- Default app port: `8003`

### Typical Dockerfile (reference)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=8003

EXPOSE 8003
CMD ["node", "src/server.js"]
```

### Build image

```bash
docker build -t payment-service:1.0.0 .
```

### Run service container only

```bash
docker run --name payment-service \
  -p 8003:8003 \
  -e PORT=8003 \
  -e PAYMENT_DB_URL=postgres://postgres:postgres@host.docker.internal:5432/payment_db \
  -e BROKER_URL=amqp://host.docker.internal:5672 \
  payment-service:1.0.0
```

### Run service and PostgreSQL together with Docker Compose

We use a dedicated PostgreSQL container plus a named Docker volume.
This is important because stopping a container must not delete payment data.

Files used:
- `docker-compose.yml`
- `db/init/01-init-payment-db.sql`

Start the stack:

```bash
docker compose up -d --build
```

Check containers:

```bash
docker compose ps
```

Open the service:

```bash
http://localhost:8003/health
http://localhost:8003/docs
```

### PostgreSQL persistence

The PostgreSQL service stores data in the named volume `payment-db-data`.
Because the data is stored in a Docker volume, the records remain even if you stop or restart the containers.

Stop containers without deleting data:

```bash
docker compose stop
docker compose start
```

Bring down containers but keep the database volume:

```bash
docker compose down
docker compose up -d
```

Delete containers and also delete the database data only when you intentionally want a fresh database:

```bash
docker compose down -v
```

### Demo seed data

The init script creates the `payments` table and inserts three demo rows the first time the database container is initialized.

Seed intent:
- one successful payment
- one pending payment
- one failed payment

This gives enough variety for assignment screenshots and API demonstrations.

### Query the seed data

```bash
docker exec -it payment-db psql -U payment_user -d payment_db -c "SELECT payment_id, order_id, status, amount FROM payments;"
```

### Verify container is running

```bash
docker ps
curl http://localhost:8003/health
```

## 8) Assignment Checklist Mapping

This README helps cover:
- Service boundary and independent responsibility (Payments)
- API operations and collaborations
- Communication style (REST + async events)
- Saga selection (choreography)
- Database-per-service ownership
- API versioning and semantic versioning policy
- Docker build and run steps for separate container deployment

## 9) Notes for Final Submission

For the final report and demos, include:
- Architecture diagram with Payment Service interactions.
- Event flow screenshot/logs for `OrderCreated -> PaymentCaptured` and failure path.
- Separate container screenshot showing payment-service running independently.
- Repository link for this service and contribution notes by team members.
