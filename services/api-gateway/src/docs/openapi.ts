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
                description: "Token issued",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        access_token: { type: "string", example: "eyJhbGciOi..." },
                        token_type: { type: "string", example: "Bearer" },
                        expires_in: { type: "integer", example: 3600 },
                        user: {
                          type: "object",
                          properties: {
                            id: { type: "string", example: "c-001" },
                            username: { type: "string", example: "alice" },
                            roles: {
                              type: "array",
                              items: { type: "string" },
                              example: ["customer"]
                            }
                          }
                        }
                      },
                      required: ["access_token", "token_type", "expires_in", "user"]
                    }
                  }
                }
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
                    required: ["items"],
                    properties: {
                      items: {
                        type: "array",
                        minItems: 1,
                        items: {
                          type: "object",
                          required: ["product_id", "quantity"],
                          properties: {
                            product_id: { type: "string", example: "p1001" },
                            quantity: { type: "integer" }
                          }
                        }
                      },
                      currency: { type: "string", example: "USD" },
                      method: {
                        type: "string",
                        example: "CARD",
                        description: "Payment method hint forwarded in the order.OrderCreated event (default: CARD)"
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
        "/api/v2/products": {
          get: {
            summary: "List products (v2)",
            responses: {
              "200": {
                description: "List of products"
              }
            }
          }
        },
        "/api/v2/orders": {
          get: {
            summary: "List orders for authenticated customer (v2)",
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
            summary: "Create a new order (v2)",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["items"],
                    properties: {
                      items: {
                        type: "array",
                        minItems: 1,
                        items: {
                          type: "object",
                          required: ["product_id", "quantity"],
                          properties: {
                            product_id: { type: "string", example: "p1001" },
                            quantity: { type: "integer" }
                          }
                        }
                      },
                      currency: { type: "string", example: "USD" },
                      method: {
                        type: "string",
                        example: "CARD",
                        description: "Payment method hint forwarded in the order.OrderCreated event (default: CARD)"
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
        "/api/v2/orders/{orderId}": {
          get: {
            summary: "Get order by ID (v2)",
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
          }
        },
        "/api/v2/orders/{orderId}/cancel": {
          post: {
            summary: "Cancel an order (v2)",
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
        "/api/v2/payments": {
          get: {
            summary: "List payments (v2)",
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
            summary: "Create a payment (v2)",
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
        "/api/v2/payments/{paymentId}": {
          get: {
            summary: "Get payment by ID (v2)",
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
        "/api/v2/payments/order/{orderId}": {
          get: {
            summary: "Get payment by order ID (v2)",
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
        "/api/v1/notifications": {
          get: {
            summary: "List notifications",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": {
                description: "List of notifications"
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          }
        },
        "/api/v1/notifications/{notificationId}": {
          get: {
            summary: "Get notification by ID",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "notificationId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Notification details"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Notification not found"
              }
            }
          }
        },
        "/api/v1/notifications/{notificationId}/read": {
          put: {
            summary: "Mark notification as read",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "notificationId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Notification marked as read"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Notification not found"
              }
            }
          }
        },
        "/api/v2/notifications": {
          get: {
            summary: "List notifications (v2)",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": {
                description: "List of notifications"
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          }
        },
        "/api/v2/notifications/{notificationId}": {
          get: {
            summary: "Get notification by ID (v2)",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "notificationId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Notification details"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Notification not found"
              }
            }
          }
        },
        "/api/v2/notifications/{notificationId}/read": {
          put: {
            summary: "Mark notification as read (v2)",
            description: "Gateway injects X-Customer-Id from JWT claim into upstream request",
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: "notificationId",
                in: "path",
                required: true,
                schema: { type: "string" }
              }
            ],
            responses: {
              "200": {
                description: "Notification marked as read"
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "404": {
                description: "Notification not found"
              }
            }
          }
        },
        "/health/all": {
          get: {
            summary: "Aggregated health of gateway and all downstream services",
            description: "Fan-out health checks to catalog, order, payment, and notification services. Returns 200 if all healthy, 503 if any are degraded.",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": {
                description: "All services healthy",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        overall: {
                          type: "string",
                          enum: ["ok", "degraded", "down"]
                        },
                        timestamp: { type: "string" },
                        services: {
                          type: "object",
                          properties: {
                            catalog: {
                              type: "object",
                              properties: {
                                status: { type: "string" },
                                latencyMs: { type: "integer" },
                                error: { type: "string" }
                              }
                            },
                            order: {
                              type: "object",
                              properties: {
                                status: { type: "string" },
                                latencyMs: { type: "integer" },
                                error: { type: "string" }
                              }
                            },
                            payment: {
                              type: "object",
                              properties: {
                                status: { type: "string" },
                                latencyMs: { type: "integer" },
                                error: { type: "string" }
                              }
                            },
                            notification: {
                              type: "object",
                              properties: {
                                status: { type: "string" },
                                latencyMs: { type: "integer" },
                                error: { type: "string" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              "401": {
                description: "Missing or invalid bearer token"
              },
              "503": {
                description: "One or more services are unhealthy"
              }
            }
          }
        },
        "/graphql": {
          post: {
            summary: "GraphQL endpoint (Phase A: read-only)",
            description: "Compose queries across catalog and order services. Requires authentication via Bearer token.",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      query: {
                        type: "string",
                        description: "GraphQL query string",
                        example: "{ products { id name price } customerOrders { id status } }"
                      },
                      variables: {
                        type: "object",
                        description: "GraphQL variables (optional)"
                      }
                    },
                    required: ["query"]
                  }
                }
              }
            },
            responses: {
              "200": {
                description: "GraphQL response with data or errors",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          description: "Query results"
                        },
                        errors: {
                          type: "array",
                          description: "GraphQL errors if any"
                        }
                      }
                    }
                  }
                }
              },
              "401": {
                description: "Missing or invalid bearer token"
              }
            }
          },
          get: {
            summary: "GraphQL UI (playground)",
            description: "Interactive GraphQL explorer (GraphiQL) with token required",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": {
                description: "GraphQL playground HTML"
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
