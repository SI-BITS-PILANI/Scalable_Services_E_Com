import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { authMeHandler, loginHandler } from "./auth/handlers.js";
import { createOpenApiSpec } from "./docs/openapi.js";
import { authMiddleware } from "./middleware/auth.js";
import { requireRole } from "./middleware/authorization.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { setupCatalogRoutes } from "./proxy/catalog.js";
import { getCatalogProxyMiddleware } from "./proxy/catalog.js";
import { setupOrderRoutes } from "./proxy/order.js";
import { setupPaymentRoutes } from "./proxy/payment.js";
import { setupNotificationRoutes } from "./proxy/notification.js";
import { getAggregatedHealth } from "./health/aggregator.js";
import { graphqlHTTP } from "express-graphql";
import { graphqlSchema } from "./graphql/schema.js";
import { createGraphQLContext } from "./graphql/resolvers.js";
import { errorHandler } from "./errors/errorHandler.js";

export function createApp() {
  const app = express();
  const limiter = createRateLimiter();
  const openApiSpec = createOpenApiSpec();

  app.use(express.json());
  app.use(cors());
  app.use(helmet());
  app.use(limiter);
  app.use(
    morgan('{"method":":method","path":":url","status":":status","latency_ms":":response-time[digits]"}')
  );

  app.get("/docs.json", (_request, response) => {
    response.status(200).json(openApiSpec);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.post("/auth/login", loginHandler);
  app.use(authMiddleware);
  app.get("/auth/me", authMeHandler);

  setupCatalogRoutes(app);
  app.post("/api/v1/products", requireRole("admin"), getCatalogProxyMiddleware());

  setupOrderRoutes(app);

  setupPaymentRoutes(app);

  setupNotificationRoutes(app);

  // GraphQL endpoint with dynamic context per request
  app.use(
    "/graphql",
    graphqlHTTP((request) => ({
        schema: graphqlSchema,
        context: createGraphQLContext(request),
        graphiql: true
      })) as any
  );

  app.get("/health/all", async (_request, response) => {
    const aggregatedHealth = await getAggregatedHealth();
    const statusCode =
      aggregatedHealth.overall === "ok" ? 200 : 503;
    response.status(statusCode).json(aggregatedHealth);
  });

  app.get("/health", (_request, response) => {
    response.status(200).json({
      service: "api-gateway",
      status: "ok"
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
