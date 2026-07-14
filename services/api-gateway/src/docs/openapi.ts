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
        "/api/v1/products": {
          post: {
            summary: "Create a product (admin-only)",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      price: { type: "number" },
                      stock: { type: "integer" }
                    }
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Product created (admin-only)"
              },
              "403": {
                description: "Insufficient permissions (admin role required)"
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          }
        },
        "/api/v1/orders": {
          get: {
            summary: "List orders for authenticated customer",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": {
                description: "List of orders for customer"
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          },
          post: {
            summary: "Create a new order",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            productId: { type: "string" },
                            quantity: { type: "integer" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            responses: {
              "201": {
                description: "Order created"
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          }
        },
        "/api/v1/orders/{orderId}": {
          get: {
            summary: "Get order by ID",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "orderId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Order details"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Order not found"
              }
            }
          },
          patch: {
            summary: "Update order",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "orderId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string" }
                    }
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Order updated"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Order not found"
              }
            }
          },
          delete: {
            summary: "Delete order",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "orderId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "204": {
                description: "Order deleted"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Order not found"
              }
            }
          }
        },
        "/api/v1/orders/{orderId}/cancel": {
          post: {
            summary: "Cancel an order",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "orderId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Order cancelled"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Order not found"
              }
            }
          }
        },
        "/api/v1/payments": {
          get: {
            summary: "List payments",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": {
                description: "List of payments"
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          },
          post: {
            summary: "Create a payment",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      orderId: { type: "string" },
                      amount: { type: "number" },
                      method: { type: "string" }
                    }
                  }
                }
              }
            },
            responses: {
              "201": {
                description: "Payment created"
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          }
        },
        "/api/v1/payments/{paymentId}": {
          get: {
            summary: "Get payment by ID",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "paymentId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Payment details"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Payment not found"
              }
            }
          }
        },
        "/api/v1/payments/order/{orderId}": {
          get: {
            summary: "Get payment by order ID",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "orderId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Payment for order"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Payment not found"
              }
            }
          }
        },
        "/api/v1/payments/{paymentId}/refund": {
          post: {
            summary: "Refund a payment",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "paymentId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      reason: { type: "string" }
                    }
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "Payment refunded"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Payment not found"
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
