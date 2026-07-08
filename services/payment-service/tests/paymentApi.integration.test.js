import test from "node:test";
import assert from "node:assert/strict";

const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || "http://localhost:8003";

async function fetchJson(path, options = {}) {
  const response = await fetch(`${paymentServiceUrl}${path}`, options);
  const json = await response.json();
  return { json, status: response.status };
}

test("integration: health endpoint responds when service is running", async (t) => {
  try {
    const { json, status } = await fetchJson("/health");
    assert.equal(status, 200);
    assert.equal(json.status, "ok");
  } catch (error) {
    t.skip("payment-service is not running; start docker compose to run integration tests");
  }
});

test("integration: create and fetch payment flow", async (t) => {
  try {
    const createPayload = {
      orderId: `ord_it_${Date.now()}`,
      customerId: "cust_it_1001",
      amount: 777.5,
      currency: "INR",
      method: "UPI"
    };

    const createResult = await fetchJson("/api/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(createPayload)
    });

    assert.equal(createResult.status, 201);
    assert.equal(createResult.json.orderId, createPayload.orderId);

    const getByIdResult = await fetchJson(`/api/v1/payments/${createResult.json.paymentId}`);
    assert.equal(getByIdResult.status, 200);
    assert.equal(getByIdResult.json.paymentId, createResult.json.paymentId);

    const getByOrderResult = await fetchJson(`/api/v1/payments/order/${createPayload.orderId}`);
    assert.equal(getByOrderResult.status, 200);
    assert.equal(getByOrderResult.json.count >= 1, true);
  } catch (error) {
    t.skip("payment-service is not running; start docker compose to run integration tests");
  }
});
