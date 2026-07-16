/**
 * Integration tests for health endpoints and public route auth bypass.
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";

async function startTestServer() {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

// ---------------------------------------------------------------------------
// GET /health  (public, no auth required)
// ---------------------------------------------------------------------------
describe("GET /health", () => {
  let baseUrl: string;
  let server: ReturnType<typeof createServer>;

  before(async () => {
    ({ server, baseUrl } = await startTestServer());
  });

  after(() => new Promise<void>((resolve) => server.close(resolve)));

  test("returns 200 with gateway status ok — no authentication needed", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.service, "api-gateway");
    assert.equal(body.status, "ok");
  });
});

// ---------------------------------------------------------------------------
// GET /health/all  (requires Bearer token)
// ---------------------------------------------------------------------------
describe("GET /health/all", () => {
  let baseUrl: string;
  let server: ReturnType<typeof createServer>;
  let aliceToken: string;

  before(async () => {
    ({ server, baseUrl } = await startTestServer());
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const loginBody: any = await loginRes.json();
    aliceToken = loginBody.access_token;
  });

  after(() => new Promise<void>((resolve) => server.close(resolve)));

  test("returns 401 AUTH_REQUIRED without a token", async () => {
    const res = await fetch(`${baseUrl}/health/all`);
    assert.equal(res.status, 401);
    const body: any = await res.json();
    assert.equal(body.error.code, "AUTH_REQUIRED");
  });

  test("returns 200 or 503 with full aggregated health structure for a valid token", async () => {
    const res = await fetch(`${baseUrl}/health/all`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    // 200 = all ok, 503 = one or more services down — both are valid in test environment
    assert.ok(
      res.status === 200 || res.status === 503,
      `Expected 200 or 503, got ${res.status}`
    );
    const body: any = await res.json();
    assert.ok(
      ["ok", "degraded", "down"].includes(body.overall),
      `overall must be ok/degraded/down, got: ${body.overall}`
    );
    assert.ok(typeof body.timestamp === "string");
    assert.ok(body.services?.catalog, "catalog service entry must be present");
    assert.ok(body.services?.order, "order service entry must be present");
    assert.ok(body.services?.payment, "payment service entry must be present");
    assert.ok(body.services?.notification, "notification service entry must be present");
  });
});

// ---------------------------------------------------------------------------
// Public route bypass — GET /api/v1/products should not demand auth
// ---------------------------------------------------------------------------
describe("Public route auth bypass", () => {
  let baseUrl: string;
  let server: ReturnType<typeof createServer>;

  before(async () => {
    ({ server, baseUrl } = await startTestServer());
  });

  after(() => new Promise<void>((resolve) => server.close(resolve)));

  test("GET /api/v1/products does not return 401 without a token", async () => {
    const res = await fetch(`${baseUrl}/api/v1/products`);
    // The proxy may return 502/504 since no real upstream is running in test,
    // but it must NOT return 401 (auth must not block this public route).
    assert.notEqual(res.status, 401, "Public product listing must not require auth");
  });

  test("POST /api/v1/orders returns 401 without a token (protected route)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
  });
});
