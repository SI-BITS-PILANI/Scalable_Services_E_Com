/**
 * Unit tests for error mapping utilities.
 * Pure functions — no server or network required.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mapErrorToStatusCode, createErrorResponse } from "../errors/errorHandler.js";

// ---------------------------------------------------------------------------
// mapErrorToStatusCode
// ---------------------------------------------------------------------------
describe("mapErrorToStatusCode", () => {
  test("maps ECONNABORTED to 504 GATEWAY_TIMEOUT", () => {
    const result = mapErrorToStatusCode({ code: "ECONNABORTED" });
    assert.equal(result.statusCode, 504);
    assert.equal(result.code, "GATEWAY_TIMEOUT");
  });

  test("maps timeout in message to 504 GATEWAY_TIMEOUT", () => {
    const result = mapErrorToStatusCode({ message: "upstream connection timeout after 5000ms" });
    assert.equal(result.statusCode, 504);
    assert.equal(result.code, "GATEWAY_TIMEOUT");
  });

  test("maps ECONNREFUSED to 502 SERVICE_UNAVAILABLE", () => {
    const result = mapErrorToStatusCode({ code: "ECONNREFUSED" });
    assert.equal(result.statusCode, 502);
    assert.equal(result.code, "SERVICE_UNAVAILABLE");
  });

  test("maps EHOSTUNREACH to 502 SERVICE_UNAVAILABLE", () => {
    const result = mapErrorToStatusCode({ code: "EHOSTUNREACH" });
    assert.equal(result.statusCode, 502);
    assert.equal(result.code, "SERVICE_UNAVAILABLE");
  });

  test("maps ENETUNREACH to 502 SERVICE_UNAVAILABLE", () => {
    const result = mapErrorToStatusCode({ code: "ENETUNREACH" });
    assert.equal(result.statusCode, 502);
    assert.equal(result.code, "SERVICE_UNAVAILABLE");
  });

  test("maps upstream 4xx response status as-is", () => {
    const result = mapErrorToStatusCode({ response: { status: 404 } });
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "UPSTREAM_ERROR");
  });

  test("maps upstream 5xx response status to 502", () => {
    const result = mapErrorToStatusCode({ response: { status: 503 } });
    assert.equal(result.statusCode, 502);
    assert.equal(result.code, "UPSTREAM_ERROR");
  });

  test("maps axios network error flag to 502 NETWORK_ERROR", () => {
    const result = mapErrorToStatusCode({ isAxiosError: true });
    assert.equal(result.statusCode, 502);
    assert.equal(result.code, "NETWORK_ERROR");
  });

  test("maps unknown error to 500 INTERNAL_SERVER_ERROR", () => {
    const result = mapErrorToStatusCode({ message: "something completely unexpected" });
    assert.equal(result.statusCode, 500);
    assert.equal(result.code, "INTERNAL_SERVER_ERROR");
  });
});

// ---------------------------------------------------------------------------
// createErrorResponse
// ---------------------------------------------------------------------------
describe("createErrorResponse", () => {
  test("returns correctly shaped error object with all fields", () => {
    const result = createErrorResponse("MY_CODE", "my message", 418, "/some/path");
    assert.equal(result.error.code, "MY_CODE");
    assert.equal(result.error.message, "my message");
    assert.equal(result.error.statusCode, 418);
    assert.equal(result.error.path, "/some/path");
    assert.ok(
      typeof result.error.timestamp === "string" && result.error.timestamp.length > 0,
      "timestamp must be a non-empty ISO string"
    );
  });

  test("returns undefined path when path argument is omitted", () => {
    const result = createErrorResponse("ERR", "oops", 500);
    assert.equal(result.error.path, undefined);
  });

  test("timestamp is a valid ISO 8601 string", () => {
    const result = createErrorResponse("X", "y", 400);
    assert.ok(
      !isNaN(Date.parse(result.error.timestamp)),
      "timestamp must parse to a valid date"
    );
  });
});
