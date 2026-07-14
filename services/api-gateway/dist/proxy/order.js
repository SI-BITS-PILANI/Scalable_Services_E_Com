import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "../config.js";
import { createErrorResponse, mapErrorToStatusCode } from "../errors/errorHandler.js";
/**
 * Middleware to inject X-Customer-Id header from JWT claim into upstream request
 * The X-Customer-Id is extracted from the JWT's 'sub' claim (customer ID)
 */
export function injectCustomerIdHeader(request, _response, next) {
    const user = request.user;
    if (user?.sub) {
        // Attach to request so proxy middleware can access it
        request.customerId = user.sub;
    }
    next();
}
export function getOrderProxyMiddleware() {
    return createProxyMiddleware({
        target: config.ORDER_BASE_URL,
        changeOrigin: true,
        pathRewrite: {
            "^/api/": "/api/"
        },
        on: {
            proxyReq: (proxyReq, request) => {
                const path = request.path || request.originalUrl || "?";
                const customerId = request.customerId;
                // Inject X-Customer-Id header into the upstream request
                if (customerId) {
                    proxyReq.setHeader("X-Customer-Id", customerId);
                    console.log(`[order-proxy] ${request.method} ${path} -> ${config.ORDER_BASE_URL}${path} (X-Customer-Id: ${customerId})`);
                }
                else {
                    console.log(`[order-proxy] ${request.method} ${path} -> ${config.ORDER_BASE_URL}${path} (WARNING: No X-Customer-Id)`);
                }
            },
            error: (err, _request, response) => {
                console.error(`[order-proxy] Error: ${err.message}`);
                const { statusCode, code, message } = mapErrorToStatusCode(err);
                const errorResponse = createErrorResponse(code, message, statusCode, "/api/v1/orders");
                response.status?.(statusCode).json?.(errorResponse);
            }
        }
    });
}
export function setupOrderRoutes(app) {
    // All order routes require authentication (to extract customer ID from JWT)
    // injectCustomerIdHeader middleware attaches customerId to request
    const orderProxy = getOrderProxyMiddleware();
    app.get("/api/v1/orders", injectCustomerIdHeader, orderProxy);
    app.post("/api/v1/orders", injectCustomerIdHeader, orderProxy);
    app.get("/api/v1/orders/:orderId", injectCustomerIdHeader, orderProxy);
    app.patch("/api/v1/orders/:orderId", injectCustomerIdHeader, orderProxy);
    app.delete("/api/v1/orders/:orderId", injectCustomerIdHeader, orderProxy);
    app.post("/api/v1/orders/:orderId/cancel", injectCustomerIdHeader, orderProxy);
}
