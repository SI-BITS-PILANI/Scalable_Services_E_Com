import { createProxyMiddleware } from "http-proxy-middleware";
import type { Router } from "express";
import { config } from "../config.js";
import { createErrorResponse, mapErrorToStatusCode } from "../errors/errorHandler.js";
import { forwardJsonBody } from "./forwardBody.js";

export function getPaymentProxyMiddleware() {
  return createProxyMiddleware({
    target: config.PAYMENT_BASE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/": "/api/"
    },
    on: {
      proxyReq: (proxyReq, request: any) => {
        const path = (request as any).path || (request as any).originalUrl || "?";
        forwardJsonBody(proxyReq, request);
        console.log(`[payment-proxy] ${request.method} ${path} -> ${config.PAYMENT_BASE_URL}${path}`);
      },
      error: (err, _request, response: any) => {
        console.error(`[payment-proxy] Error: ${err.message}`);
        const { statusCode, code, message } = mapErrorToStatusCode(err);
        const errorResponse = createErrorResponse(
          code,
          message,
          statusCode,
          "/api/v1/payments"
        );
        response.status?.(statusCode).json?.(errorResponse);
      }
    }
  });
}

export function setupPaymentRoutes(app: Router) {
  const paymentProxy = getPaymentProxyMiddleware();

  // v1 payment routes
  app.get("/api/v1/payments", paymentProxy);
  app.post("/api/v1/payments", paymentProxy);
  app.get("/api/v1/payments/:paymentId", paymentProxy);
  app.get("/api/v1/payments/order/:orderId", paymentProxy);
  app.post("/api/v1/payments/:paymentId/refund", paymentProxy);

  // v2 payment routes
  app.get("/api/v2/payments", paymentProxy);
  app.post("/api/v2/payments", paymentProxy);
  app.get("/api/v2/payments/:paymentId", paymentProxy);
  app.get("/api/v2/payments/order/:orderId", paymentProxy);
}
