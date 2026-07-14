import { createProxyMiddleware } from "http-proxy-middleware";
import type { Router } from "express";
import { config } from "../config.js";
import { createErrorResponse, mapErrorToStatusCode } from "../errors/errorHandler.js";

export function getCatalogProxyMiddleware() {
  return createProxyMiddleware({
    target: config.CATALOG_BASE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/": "/api/"
    },
    on: {
      proxyReq: (proxyReq, request) => {
        const path = (request as any).path || (request as any).originalUrl || "?";
        console.log(`[catalog-proxy] ${request.method} ${path} -> ${config.CATALOG_BASE_URL}${path}`);
      },
      error: (err, _request, response: any) => {
        console.error(`[catalog-proxy] Error: ${err.message}`);
        const { statusCode, code, message } = mapErrorToStatusCode(err);
        const errorResponse = createErrorResponse(
          code,
          message,
          statusCode,
          "/api/v1/products"
        );
        response.status?.(statusCode).json?.(errorResponse);
      }
    }
  });
}

export function setupCatalogRoutes(app: Router) {
  const catalogProxy = getCatalogProxyMiddleware();

  // GET routes are public (no auth required)
  app.get("/api/v1/products", catalogProxy);
  app.get("/api/v1/products/:id", catalogProxy);
  app.get("/api/v2/products", catalogProxy);
}

