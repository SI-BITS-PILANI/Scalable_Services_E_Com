import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "../config.js";
import { createErrorResponse, mapErrorToStatusCode } from "../errors/errorHandler.js";
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
                const { statusCode, code, message } = mapErrorToStatusCode(err);
                const errorResponse = createErrorResponse(code, message, statusCode, "/api/v1/payments");
                response.status?.(statusCode).json?.(errorResponse);
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
