import { createProxyMiddleware } from "http-proxy-middleware";
import type { Router } from "express";
import { config } from "../config.js";

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
        response.status?.(502).json?.({
          error: {
            code: "CATALOG_SERVICE_ERROR",
            message: "Failed to reach catalog service"
          }
        });
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

