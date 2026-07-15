# Saga Choreography - Required Cross-Service Changes

This file documents what still needs to be changed in OTHER services to complete choreography-based saga around payment.

Scope note:
- No additional code changes are made in other services by this step.
- Event naming convention is fixed to namespaced routing keys:
  - `order.OrderCreated`
  - `payment.PaymentCaptured`
  - `payment.PaymentFailed`

## 1) Order Service - Required updates

Current behavior:
- Publishes `order.OrderCreated`.
- Also calls payment-service synchronously via REST (`POST /api/v1/payments`).

Required changes for choreography completion:
1. Make `order.OrderCreated` payload complete enough for payment processing:
   - required fields:
     - `order_id`
     - `customer_id`
     - `amount`
     - `currency`
   - optional:
     - `method` (default `CARD` if absent)
2. Remove or feature-flag the synchronous payment REST call from create-order flow once async path is fully verified.
3. Add consumer for payment outcome events:
   - `payment.PaymentCaptured` -> mark order `PAID`
   - `payment.PaymentFailed` -> mark order `CANCELLED` or `PAYMENT_FAILED`
4. Add idempotent handling for repeated payment outcome events.

## 2) Payment Service - Remaining work

Current behavior:
- Consumer for `order.OrderCreated` exists.
- Next implementation steps in payment-service:
1. Persist payment record from consumed event.
2. Add idempotency guard (avoid duplicate payments for same order/event replay).
3. Publish outcome events:
   - `payment.PaymentCaptured` on success
   - `payment.PaymentFailed` on failure
4. Add durable event log table if needed (`payment_events`) for traceability.

## 3) Notification Service - Verification updates

Current behavior:
- Already consumes `order.*` and `payment.*`.

Required updates:
1. Confirm templates and mapping include:
   - `payment.PaymentCaptured`
   - `payment.PaymentFailed`
2. Ensure message parsing is resilient if payload schema evolves.
3. Add or update tests for new payment event payload shape.

## 4) Root Compose - Integration wiring

Required verification in root compose:
1. Payment service must receive RabbitMQ settings:
   - `RABBITMQ_URL`
   - `RABBITMQ_EXCHANGE`
   - `RABBITMQ_ORDER_CREATED_QUEUE`
   - `RABBITMQ_ORDER_CREATED_KEY`
2. Payment service `depends_on` should include RabbitMQ health condition.
3. Exchange name should be shared and consistent (`ecom.events`) across all publishers/consumers.

## 5) Event Contract (recommended)

### order.OrderCreated
```json
{
  "order_id": "ord_123",
  "customer_id": "cust_456",
  "amount": 1499.0,
  "currency": "INR",
  "method": "CARD"
}
```

### payment.PaymentCaptured
```json
{
  "order_id": "ord_123",
  "customer_id": "cust_456",
  "payment_id": "pay_789",
  "transaction_ref": "txn_111",
  "status": "SUCCEEDED"
}
```

### payment.PaymentFailed
```json
{
  "order_id": "ord_123",
  "customer_id": "cust_456",
  "status": "FAILED",
  "reason": "INSUFFICIENT_FUNDS"
}
```

## 6) End-to-End Acceptance Checklist

1. Create order -> Order service publishes `order.OrderCreated`.
2. Payment service consumes event and writes payment record exactly once.
3. Payment service publishes captured/failed event.
4. Order service consumes payment outcome and updates order state.
5. Notification service stores customer notification.
6. Replaying same event does not create duplicate payment/order transitions.

## 7) Suggested Rollout Order

1. Complete payment persistence + idempotency in payment-service.
2. Add payment outcome publish in payment-service.
3. Add order outcome consumer in order-service.
4. Run full docker-compose integration smoke tests.
5. Update READMEs and demo evidence screenshots.
