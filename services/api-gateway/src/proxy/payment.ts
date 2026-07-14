import { createProxyMiddleware } from "http-proxy-middleware";
import type { Router } from "express";
import { config } from "../config.js";

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
        console.log(`[payment-proxy] ${request.method} ${path} -> ${config.PAYMENT_BASE_URL}${path}`);
      },
      error: (err, _request, response: any) => {
        console.error(`[payment-proxy] Error: ${err.message}`);
        response.status?.(502).json?.({
          error: {
            code: "PAYMENT_SERVICE_ERROR",
            message: "Failed to reach payment service"
          }
        });
      }
    }
  });
}

export function setupPaymentRoutes(app: Router) {
  const paymentProxy = getPaymentProxyMiddleware();

  // All payment routes
  app.get("/api/v1/payments", paymentProxy);
  app.post("/api/v1/payments", paymentProxy);
  app.get("/api/v1/payments/:paymentId", paymentProxy);
  app.get("/api/v1/payments/order/:orderId", paymentProxy);
  app.post("/api/v1/payments/:paymentId/refund", paymentProxy);
}
