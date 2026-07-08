import test from "node:test";
import assert from "node:assert/strict";
import { validateCreatePaymentPayload } from "../app/utils/paymentValidators.js";

test("validateCreatePaymentPayload returns null for valid payload", () => {
  const errorMessage = validateCreatePaymentPayload({
    orderId: "ord_1001",
    customerId: "cust_1001",
    amount: 1499,
    currency: "INR",
    method: "CARD"
  });

  assert.equal(errorMessage, null);
});

test("validateCreatePaymentPayload rejects missing required fields", () => {
  const errorMessage = validateCreatePaymentPayload({
    customerId: "cust_1001",
    amount: 1499,
    currency: "INR",
    method: "CARD"
  });

  assert.equal(errorMessage, "orderId, customerId, amount, currency and method are required");
});

test("validateCreatePaymentPayload rejects non-positive amount", () => {
  const errorMessage = validateCreatePaymentPayload({
    orderId: "ord_1001",
    customerId: "cust_1001",
    amount: 0,
    currency: "INR",
    method: "CARD"
  });

  assert.equal(errorMessage, "amount must be a number greater than 0");
});

test("validateCreatePaymentPayload rejects unsupported method", () => {
  const errorMessage = validateCreatePaymentPayload({
    orderId: "ord_1001",
    customerId: "cust_1001",
    amount: 1499,
    currency: "INR",
    method: "CRYPTO"
  });

  assert.equal(errorMessage, "method must be one of CARD, UPI, NET_BANKING, WALLET");
});
