import { createProxyMiddleware } from "http-proxy-middleware";
import type { NextFunction, Request, Response, Router } from "express";
import { config } from "../config.js";
import type { AuthenticatedUser } from "../auth/types.js";
import { createErrorResponse, mapErrorToStatusCode } from "../errors/errorHandler.js";
import { forwardJsonBody } from "./forwardBody.js";

export function injectCustomerIdHeader(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const user = request.user as AuthenticatedUser | undefined;
  if (user?.sub) {
    (request as any).customerId = user.sub;
  }
  next();
}

export function getNotificationProxyMiddleware() {
  return createProxyMiddleware({
    target: config.NOTIFICATION_BASE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/": "/api/"
    },
    on: {
      proxyReq: (proxyReq, request: any) => {
        const path = (request as any).path || (request as any).originalUrl || "?";
        forwardJsonBody(proxyReq, request);
        const customerId = (request as any).customerId;
        if (customerId) {
          proxyReq.setHeader("X-Customer-Id", customerId);
          console.log(
            `[notification-proxy] ${request.method} ${path} -> ${config.NOTIFICATION_BASE_URL}${path} (X-Customer-Id: ${customerId})`
          );
        } else {
          console.log(
            `[notification-proxy] ${request.method} ${path} -> ${config.NOTIFICATION_BASE_URL}${path} (WARNING: No X-Customer-Id)`
          );
        }
      },
      error: (err, _request, response: any) => {
        console.error(`[notification-proxy] Error: ${err.message}`);
        const { statusCode, code, message } = mapErrorToStatusCode(err);
        const errorResponse = createErrorResponse(
          code,
          message,
          statusCode,
          "/api/v1/notifications"
        );
        response.status?.(statusCode).json?.(errorResponse);
      }
    }
  });
}

export function setupNotificationRoutes(app: Router) {
  const notificationProxy = getNotificationProxyMiddleware();

  // v1 notification routes
  app.get("/api/v1/notifications", injectCustomerIdHeader, notificationProxy);
  app.get("/api/v1/notifications/:notificationId", injectCustomerIdHeader, notificationProxy);
  app.put("/api/v1/notifications/:notificationId/read", injectCustomerIdHeader, notificationProxy);

  // v2 notification routes
  app.get("/api/v2/notifications", injectCustomerIdHeader, notificationProxy);
  app.get("/api/v2/notifications/:notificationId", injectCustomerIdHeader, notificationProxy);
  app.put("/api/v2/notifications/:notificationId/read", injectCustomerIdHeader, notificationProxy);
}
