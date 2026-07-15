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
```

2. Use token for protected APIs:

```bash
curl http://localhost:8000/health/all -H "Authorization: Bearer <token>"
curl http://localhost:8000/api/v1/products -H "Authorization: Bearer <token>"
curl -X POST http://localhost:8000/api/v1/orders \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-d '{"items":[{"product_id":"p1001","quantity":1}]}'
curl http://localhost:8000/api/v1/orders -H "Authorization: Bearer <token>"
curl http://localhost:8000/api/v1/notifications -H "Authorization: Bearer <token>"
```

## Stop Stack

```bash
docker compose down
```
