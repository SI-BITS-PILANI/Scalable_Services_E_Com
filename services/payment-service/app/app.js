import express from "express";
import { loadOpenApiDocument } from "./config/openApiConfig.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import { createDocsRouter } from "./routes/docsRoutes.js";
import healthRouter from "./routes/healthRoutes.js";
import paymentRouter from "./routes/paymentRoutes.js";

export function createApp() {
  const app = express();
  const openApiDocument = loadOpenApiDocument();

  app.use(express.json());

  // Route registration is centralized here so bootstrapping and business logic stay separate.
  app.use(createDocsRouter(openApiDocument));
  app.use(healthRouter);
  app.use(paymentRouter);

  app.use(globalErrorHandler);

  return app;
}
