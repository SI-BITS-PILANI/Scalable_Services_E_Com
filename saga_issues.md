# Saga Choreography Integration Issues

This file tracks currently identified cross-service saga event integration issues.

## Current Status

- No known open code-level saga choreography issues remain in the implemented flow.
- Remaining validation is integration-level execution in shared environments (RabbitMQ + all services running together).

## Critical

1. `order.OrderCreated` payload mismatch
- ✅ COMPLETED: Order service now publishes `order_id`, `customer_id`, `amount`, and `currency` in `order.OrderCreated`.
- ✅ COMPLETED: Order service RabbitMQ publisher now forwards the full event payload instead of truncating fields.
- Impact: Payment consumer can validate and process incoming `order.OrderCreated` events.

2. Missing payment outcome events in runtime flow
- ✅ COMPLETED: Payment service now publishes `payment.PaymentCaptured` and `payment.PaymentFailed` events to RabbitMQ
- ✅ COMPLETED: Order service now consumes payment outcome events and updates order status asynchronously
- Choreography loop is complete for payment outcomes

3. Missing order outcome consumer for payment events
- ✅ COMPLETED: Order service now has a payment outcome consumer listening for `payment.PaymentCaptured` and `payment.PaymentFailed`
- ✅ COMPLETED: Order status is updated asynchronously from PENDING → PAID on PaymentCaptured, PENDING → CANCELLED on PaymentFailed
- Impact: Order state is now properly updated via event choreography

4. Acknowledge-on-failure behavior in payment consumer
- ✅ COMPLETED: Payment consumer now `nack`s with requeue on persistence failures instead of `ack`.
- ✅ COMPLETED: Invalid payloads are still acknowledged (non-retryable), while transient persistence failures are retried by broker delivery.
- Impact: Technical failures no longer drop events immediately; RabbitMQ retry semantics are preserved.

5. Payment outcome publish reliability
- ✅ COMPLETED: Payment outcome publishing now uses a confirm channel and waits for broker confirms before completing.
- ✅ COMPLETED: Publish failures now raise errors so the consumer can avoid acking and trigger retry.
- Impact: Order-created events are not acknowledged as successful unless payment outcome event publication succeeds.

## High

5. Mixed sync + async payment path
- ✅ COMPLETED: Order service synchronous payment call is now feature-flagged via `ORDER_SYNC_PAYMENT_ENABLED`.
- ✅ COMPLETED: Default flow is async-first choreography (publish `order.OrderCreated` and rely on payment outcome events).
- Impact: Default runtime avoids duplicate payment attempts from parallel sync+async execution paths.

6. Non-atomic idempotency in payment persistence
- ✅ COMPLETED: Payment consumer persistence now uses single-statement conflict-safe insert (`INSERT ... ON CONFLICT (order_id) DO NOTHING`).
- ✅ COMPLETED: Payment DB now enforces uniqueness on `payments.order_id` via unique index.
- Impact: Concurrent deliveries for same order are deduplicated atomically at database level.

## Medium

7. Documentation/runtime drift
- ✅ COMPLETED: `order-service` README updated to async-first choreography with optional sync fallback via `ORDER_SYNC_PAYMENT_ENABLED`.
- ✅ COMPLETED: `payment-service` README updated to match current runtime events (`payment.PaymentCaptured`, `payment.PaymentFailed`), retry semantics, and atomic idempotency implementation.
- Impact: Documentation now reflects current runtime behavior and integration expectations.

8. Failure path unreachable from normal order flow
- ✅ COMPLETED: Order request now carries `method` and order service includes it in `order.OrderCreated` payload.
- ✅ COMPLETED: Payment consumer can deterministically produce `payment.PaymentFailed` when configured failure method is used.
- Impact: Both success and failure saga paths are reachable via normal choreography input.

## Validation Note

- Unit-level validation is complete for changed payment event logic.
- End-to-end validation should be executed in shared dev/staging with all services and broker running.
