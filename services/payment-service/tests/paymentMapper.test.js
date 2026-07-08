import test from "node:test";
import assert from "node:assert/strict";
import { mapPaymentRow } from "../app/utils/paymentMapper.js";

test("mapPaymentRow transforms DB row shape to API shape", () => {
  const mapped = mapPaymentRow({
    payment_id: "pay_1001",
    order_id: "ord_1001",
    customer_id: "cust_1001",
    amount: "1499.00",
    currency: "INR",
    method: "CARD",
    status: "SUCCEEDED",
    transaction_ref: "txn_1001",
    created_at: "2026-07-08T10:00:00.000Z",
    updated_at: "2026-07-08T10:01:00.000Z"
  });

  assert.deepEqual(mapped, {
    paymentId: "pay_1001",
    orderId: "ord_1001",
    customerId: "cust_1001",
    amount: 1499,
    currency: "INR",
    method: "CARD",
    status: "SUCCEEDED",
    transactionRef: "txn_1001",
    createdAt: "2026-07-08T10:00:00.000Z",
    updatedAt: "2026-07-08T10:01:00.000Z"
  });
});
