# Scalable_Services_E_Com
ShopFlow lets a customer browse a product catalog, place an order, have the payment processed, and receive notifications about the outcome. 

## Services

- API Gateway: `http://localhost:8000`
- Catalog Service: `http://localhost:8001`
- Order Service: `http://localhost:8002`
- Payment Service: `http://localhost:8003`
- Notification Service: `http://localhost:8004`
- RabbitMQ Management: `http://localhost:15672` (guest/guest)

## Infrastructure Layout

- Shared PostgreSQL bootstrap scripts: `infra/postgres/init/`
- Shared Docker orchestration entrypoint: `docker-compose.yml`

Database ownership is isolated by service:

- `payment_db` owned by `payment_user`
- `order_db` owned by `order_user`

## Run Full Stack (Demo)

From repository root:

```bash
docker compose up -d --build
```

Check containers:

```bash
docker compose ps
```

## Quick Demo Flow (via API Gateway)

1. Login and get token:

```bash
curl -X POST http://localhost:8000/auth/login \
	-H "Content-Type: application/json" \
	-d '{"username":"alice","password":"password123"}'

# Use the `access_token` field from the login response as <token>.
```

2. Use token for protected APIs:

```bash
curl http://localhost:8000/health/all -H "Authorization: Bearer <token>"
curl http://localhost:8000/api/v1/products   # public — no token required
curl -X POST http://localhost:8000/api/v1/orders \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-d '{"items":[{"product_id":"p1001","quantity":1}],"currency":"USD","method":"CARD"}'
curl http://localhost:8000/api/v1/orders -H "Authorization: Bearer <token>"
curl http://localhost:8000/api/v1/notifications -H "Authorization: Bearer <token>"
```

## Stop Stack

```bash
docker compose down
```

## CI / CD

This monorepo uses **path-filtered GitHub Actions** so each service is tested and built independently. Only the workflow for the changed service runs on each push/PR.

### Workflows

| Workflow | Trigger Path | Jobs |
|---|---|---|
| [API Gateway](.github/workflows/api-gateway.yml) | `services/api-gateway/**` | Type check → Tests → Docker build → Push (main) |
| [Catalog Service](.github/workflows/catalog-service.yml) | `services/catalog-service/**` | Tests → Docker build → Push (main) |
| [Order Service](.github/workflows/order-service.yml) | `services/order-service/**` | Tests → Docker build → Push (main) |
| [Payment Service](.github/workflows/payment-service.yml) | `services/payment-service/**` | Tests → Docker build → Push (main) |
| [Notification Service](.github/workflows/notification-service.yml) | `services/notification-service/**` | Tests → Docker build → Push (main) |
| [Infrastructure](.github/workflows/infra.yml) | `docker-compose.yml`, `infra/**` | Compose validate → SQL init scripts validate |
| [Full Stack Deploy](.github/workflows/full-stack.yml) | Manual dispatch / cross-service changes on main | All services build + test + push in parallel |

### How It Works

- **Per-service PRs** — Changing files under `services/<name>/` only triggers that service's workflow. Other services are unaffected.
- **Docker image push** — Images are pushed to GitHub Container Registry (`ghcr.io`) only on pushes to `main`.
- **Full stack deploy** — Trigger manually from Actions tab to build, test, and push all services at once (useful for coordinated releases).
- **Service ownership** — `.github/CODEOWNERS` assigns review ownership per service directory.

### Local Testing

Each service can be tested locally without the full stack:

```bash
# API Gateway (TypeScript)
cd services/api-gateway && npm install && npm test

# Catalog Service (Python)
cd services/catalog-service && pip install -r requirements.txt && pytest

# Order Service (Python)
cd services/order-service && pip install -r requirements.txt && pytest

# Payment Service (Node.js)
cd services/payment-service && npm install && npm test

# Notification Service (Python)
cd services/notification-service && pip install -r requirements.txt && pytest
```
