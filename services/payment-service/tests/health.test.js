import test from "node:test";
import assert from "node:assert/strict";
import { allowedPaymentMethods } from "../app/constants/paymentConstants.js";

test("allowed payment methods include supported options", async () => {
  // Keep a lightweight guard test so accidental constant changes are caught early.
  try {
    assert.equal(allowedPaymentMethods.has("CARD"), true);
    assert.equal(allowedPaymentMethods.has("UPI"), true);
    assert.equal(allowedPaymentMethods.has("NET_BANKING"), true);
    assert.equal(allowedPaymentMethods.has("WALLET"), true);
  } catch (error) {
    assert.fail(error.message);
  }
});
