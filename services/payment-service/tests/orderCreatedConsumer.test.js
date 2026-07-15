import test from "node:test";
import assert from "node:assert/strict";
import { parseAndValidateOrderCreatedMessage } from "../app/events/orderCreatedConsumer.js";

test("parseAndValidateOrderCreatedMessage accepts valid payload", () => {
  const message = Buffer.from(
    JSON.stringify({
      order_id: "ord_1001",
      customer_id: "cust_1001",
      amount: 1499,
      currency: "INR",
      method: "CARD"
    }),
    "utf-8"
  );

  const result = parseAndValidateOrderCreatedMessage(message);

  assert.equal(result.error, null);
  assert.deepEqual(result.payload, {
    orderId: "ord_1001",
    customerId: "cust_1001",
    amount: 1499,
    currency: "INR",
    method: "CARD"
  });
});

test("parseAndValidateOrderCreatedMessage rejects missing fields", () => {
  const message = Buffer.from(
    JSON.stringify({ order_id: "ord_1001", customer_id: "cust_1001" }),
    "utf-8"
  );

  const result = parseAndValidateOrderCreatedMessage(message);

  assert.equal(result.error, "amount must be present and greater than 0");
  assert.equal(result.payload, null);
});

test("parseAndValidateOrderCreatedMessage rejects invalid JSON", () => {
  const message = Buffer.from("not-json", "utf-8");

  const result = parseAndValidateOrderCreatedMessage(message);

  assert.equal(result.error, "invalid JSON payload");
  assert.equal(result.payload, null);
});
