import express from "express";
import swaggerUi from "swagger-ui-express";
import { getDocsJson } from "../controllers/docsController.js";

export function createDocsRouter(openApiDocument) {
  const router = express.Router();

  // Swagger route is kept in dedicated router to avoid crowding business routes.
  router.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  router.get("/docs.json", getDocsJson(openApiDocument));

  return router;
}
