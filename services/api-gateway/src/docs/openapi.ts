import swaggerJSDoc from "swagger-jsdoc";

export function createOpenApiSpec() {
  return swaggerJSDoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "API Gateway",
        version: "1.0.0",
        description: "Gateway APIs for Scalable Services E-Com"
      },
      servers: [
        {
          url: "http://localhost:8000"
        }
      ],
      paths: {
        "/auth/login": {
          post: {
            summary: "Issue a JWT for demo users",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["username", "password"],
                    properties: {
                      username: { type: "string", example: "alice" },
                      password: { type: "string", example: "password123" }
                    }
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Token issued"
              },
              "400": {
                description: "Invalid login payload"
              },
              "401": {
                description: "Invalid username or password"
              }
            }
          }
        },
        "/auth/me": {
          get: {
            summary: "Get current authenticated user claims",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": {
                description: "Authenticated user claims"
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          }
        },
        "/health": {
          get: {
            summary: "Gateway health",
            responses: {
              "200": {
                description: "Gateway is healthy"
              }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    },
    apis: []
  });
}
