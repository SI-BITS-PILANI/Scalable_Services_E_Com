-- Dedicated credentials + database for payment-service.
CREATE USER payment_user WITH PASSWORD 'payment_password';
CREATE DATABASE payment_db OWNER payment_user;

\c payment_db

SET ROLE payment_user;

-- Create the payments table so the service has a stable schema to build on.
CREATE TABLE IF NOT EXISTS payments (
  payment_id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  customer_id VARCHAR(50) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  transaction_ref VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_order_id ON payments(order_id);

-- Minimal seed data helps with demo queries and screenshots before POST APIs are implemented.
INSERT INTO payments (
  payment_id,
  order_id,
  customer_id,
  amount,
  currency,
  method,
  status,
  transaction_ref
)
SELECT *
FROM (
  VALUES
    ('pay_demo_1001', 'ord_demo_1001', 'cust_demo_1001', 1499.00, 'INR', 'CARD', 'SUCCEEDED', 'txn_demo_1001'),
    ('pay_demo_1002', 'ord_demo_1002', 'cust_demo_1002', 899.00, 'INR', 'UPI', 'PENDING', 'txn_demo_1002'),
    ('pay_demo_1003', 'ord_demo_1003', 'cust_demo_1003', 2299.00, 'INR', 'NET_BANKING', 'FAILED', 'txn_demo_1003')
) AS seed_rows (
  payment_id,
  order_id,
  customer_id,
  amount,
  currency,
  method,
  status,
  transaction_ref
)
WHERE NOT EXISTS (
  SELECT 1 FROM payments
);

RESET ROLE;
