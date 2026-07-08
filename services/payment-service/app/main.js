import express from "express";
import swaggerUi from "swagger-ui-express";
import yaml from "yamljs";

const app = express();
const port = Number(process.env.PORT) || 8003;
const openApiDocument = yaml.load("./app/docs/openapi.yaml");

app.use(express.json());

// Add Swagger early so API contract is visible while endpoints are implemented incrementally.
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Expose the raw OpenAPI JSON so gateway/tests can consume the spec programmatically.
app.get("/docs.json", (request, response) => {
  try {
    response.status(200).json(openApiDocument);
  } catch (error) {
    response.status(500).json({
      error: {
        code: "SWAGGER_DOCS_FAILED",
        message: "Unable to load OpenAPI document"
      }
    });
  }
});

// We start with a health endpoint first so container and gateway checks can validate service availability.
app.get("/health", (request, response) => {
  try {
    response.status(200).json({
      service: "payment-service",
      status: "ok",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    response.status(500).json({
      error: {
        code: "HEALTH_CHECK_FAILED",
        message: "Unable to evaluate health status"
      }
    });
  }
});

// This is a temporary scaffold endpoint so we can add payment APIs incrementally in later steps.
app.get("/api/v1/payments", (request, response) => {
  try {
    response.status(200).json({
      message: "Payment service scaffold is ready",
      nextStep: "Implement POST /api/v1/payments"
    });
  } catch (error) {
    response.status(500).json({
      error: {
        code: "PAYMENT_ROUTE_FAILED",
        message: "Failed to process payments route"
      }
    });
  }
});

// Global error middleware gives a consistent response structure when we add more routes.
app.use((error, request, response, next) => {
  try {
    response.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error?.message || "Unexpected server error"
      }
    });
  } catch (handlerError) {
    response.status(500).end();
  }
});

app.listen(port, () => {
  console.log(`payment-service running on port ${port}`);
});
