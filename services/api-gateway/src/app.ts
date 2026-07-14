import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { authMeHandler, loginHandler } from "./auth/handlers.js";
import { createOpenApiSpec } from "./docs/openapi.js";
import { authMiddleware } from "./middleware/auth.js";
import { createRateLimiter } from "./middleware/rateLimit.js";

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

  app.get("/health", (_request, response) => {
    response.status(200).json({
      service: "api-gateway",
      status: "ok"
    });
  });

  return app;
}
