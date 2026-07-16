/**
 * Unit tests for Express middleware: requireRole and authMiddleware public-route bypass.
 * No HTTP server needed — middleware is called directly with mock objects.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { requireRole } from "../middleware/authorization.js";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockReq(user?: { sub: string; username: string; roles: string[] }): Request {
  return { user } as unknown as Request;
}

function mockRes() {
  const ctx = { status: 200, body: null as any };
  const res = {
    status(code: number) {
      ctx.status = code;
      return res;
    },
    json(data: any) {
      ctx.body = data;
      return res;
    },
  } as unknown as Response;
  return { res, ctx };
}

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------
describe("requireRole middleware", () => {
  test("calls next when user has the required role", () => {
    const { res, ctx } = mockRes();
    let nextCalled = false;
    requireRole("customer")(
      mockReq({ sub: "c-001", username: "alice", roles: ["customer"] }),
      res,
      (() => { nextCalled = true; }) as NextFunction
    );
    assert.equal(nextCalled, true);
    assert.equal(ctx.status, 200, "status should remain untouched when next() is called");
  });

  test("calls next when user has one of multiple allowed roles", () => {
    const { res } = mockRes();
    let nextCalled = false;
    requireRole("admin", "moderator")(
      mockReq({ sub: "c-admin", username: "admin", roles: ["admin", "customer"] }),
      res,
      (() => { nextCalled = true; }) as NextFunction
    );
    assert.equal(nextCalled, true);
  });

  test("returns 403 INSUFFICIENT_PERMISSIONS when user lacks the required role", () => {
    const { res, ctx } = mockRes();
    requireRole("admin")(
      mockReq({ sub: "c-001", username: "alice", roles: ["customer"] }),
      res,
      (() => {}) as NextFunction
    );
    assert.equal(ctx.status, 403);
    assert.equal(ctx.body.error.code, "INSUFFICIENT_PERMISSIONS");
    assert.deepEqual(ctx.body.requiredRoles, ["admin"]);
    assert.deepEqual(ctx.body.userRoles, ["customer"]);
  });

  test("returns 403 when user has none of multiple allowed roles", () => {
    const { res, ctx } = mockRes();
    requireRole("admin", "moderator")(
      mockReq({ sub: "c-001", username: "alice", roles: ["customer"] }),
      res,
      (() => {}) as NextFunction
    );
    assert.equal(ctx.status, 403);
    assert.deepEqual(ctx.body.requiredRoles, ["admin", "moderator"]);
    assert.deepEqual(ctx.body.userRoles, ["customer"]);
  });

  test("returns 401 AUTH_REQUIRED when no user is attached to request", () => {
    const { res, ctx } = mockRes();
    requireRole("customer")(
      mockReq(undefined),
      res,
      (() => {}) as NextFunction
    );
    assert.equal(ctx.status, 401);
    assert.equal(ctx.body.error.code, "AUTH_REQUIRED");
  });
});
