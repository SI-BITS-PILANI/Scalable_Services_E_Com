# API Gateway

The single entry point for all clients (port **8000**). Hides the internal
service topology and centralizes cross-cutting concerns.

## Responsibilities
| Concern | How |
|---------|-----|
| Routing / reverse proxy | REST requests forwarded to catalog/order/payment/notification |
| API composition | `/health/all` aggregates downstream health; `/graphql` stitches services |
| Authentication | `POST /auth/login` issues a JWT; protected routes require `Bearer` token |
| Authorization | `POST /api/v1/products` requires the `admin` role |
| Logging | every request logged with method, path, status, latency |
| Rate limiting | fixed window, `RATE_LIMIT_PER_MINUTE` (default 60) per client IP |

## Demo credentials
| Username | Password | Roles |
|----------|----------|-------|
| `alice` | `password123` | customer |
| `admin` | `admin123` | admin, customer |

## Auth flow
```bash
# 1) login -> get a token
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'

# 2) call a protected route
curl -s http://localhost:8000/api/v1/orders \
  -H "Authorization: Bearer <token>"
```

## Routing map
| Public | Method | Gateway path | Upstream |
|--------|--------|--------------|----------|
| ✅ | GET | `/api/v1/products` | catalog |
| ✅ | GET | `/api/v2/products` | catalog (v2) |
| ✅ | GET | `/api/v1/products/{id}` | catalog |
| admin | POST | `/api/v1/products` | catalog |
| 🔒 | POST/GET | `/api/v1/orders...` | order |
| 🔒 | GET | `/api/v1/payments...` | payment |
| 🔒 | GET | `/api/v1/notifications...` | notification |
| ✅ | POST/GET | `/graphql` | composition (catalog+order+notification) |

## Sample GraphQL query
```graphql
query {
  products { productId name price available }
  customerDashboard(customerId: "c-001") {
    orders { orderId status total }
    notifications { eventType message }
  }
}
```
Open the GraphiQL playground at <http://localhost:8000/graphql>.
