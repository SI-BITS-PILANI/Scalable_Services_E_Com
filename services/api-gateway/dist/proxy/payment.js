import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "../config.js";
export function getPaymentProxyMiddleware() {
    return createProxyMiddleware({
        target: config.PAYMENT_BASE_URL,
        changeOrigin: true,
        pathRewrite: {
            "^/api/": "/api/"
        },
        on: {
            proxyReq: (proxyReq, request) => {
                const path = request.path || request.originalUrl || "?";
                console.log(`[payment-proxy] ${request.method} ${path} -> ${config.PAYMENT_BASE_URL}${path}`);
            },
            error: (err, _request, response) => {
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
export function setupPaymentRoutes(app) {
    const paymentProxy = getPaymentProxyMiddleware();
    // All payment routes
    app.get("/api/v1/payments", paymentProxy);
    app.post("/api/v1/payments", paymentProxy);
    app.get("/api/v1/payments/:paymentId", paymentProxy);
    app.get("/api/v1/payments/order/:orderId", paymentProxy);
    app.post("/api/v1/payments/:paymentId/refund", paymentProxy);
}
