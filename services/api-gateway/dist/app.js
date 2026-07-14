import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { z } from "zod";
import { config } from "./config.js";
const jwtClaimsSchema = z.object({
    sub: z.string().min(1),
    username: z.string().min(1),
    roles: z.array(z.string())
});
function isPublicRoute(request) {
    if (request.path === "/health" || request.path === "/auth/login" || request.path === "/docs.json") {
        return true;
    }
    if (request.path.startsWith("/docs")) {
        return true;
    }
    if (request.method === "GET") {
        if (request.path === "/api/v1/products" || request.path === "/api/v2/products") {
            return true;
        }
        if (request.path.startsWith("/api/v1/products/")) {
            return true;
        }
    }
    return false;
}
export function createApp() {
    const app = express();
    const loginRequestSchema = z.object({
        username: z.string().min(1),
        password: z.string().min(1)
    });
    const demoUsers = [
        {
            username: "alice",
            password: "password123",
            subject: "c-001",
            roles: ["customer"]
        },
        {
            username: "admin",
            password: "admin123",
            subject: "c-admin",
            roles: ["admin", "customer"]
        }
    ];
    const limiter = rateLimit({
        windowMs: 60 * 1000,
        limit: config.RATE_LIMIT_PER_MINUTE,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_request, response) => {
            response.status(429).json({
                error: {
                    code: "RATE_LIMIT_EXCEEDED",
                    message: "Too many requests from this IP. Please retry after one minute."
                },
                limitPerMinute: config.RATE_LIMIT_PER_MINUTE
            });
        }
    });
    app.use(express.json());
    app.use(cors());
    app.use(helmet());
    app.use(limiter);
    app.use(morgan('{"method":":method","path":":url","status":":status","latency_ms":":response-time[digits]"}'));
    const openApiSpec = swaggerJSDoc({
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
    app.get("/docs.json", (_request, response) => {
        response.status(200).json(openApiSpec);
    });
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
    app.post("/auth/login", (request, response) => {
        const parsedPayload = loginRequestSchema.safeParse(request.body);
        if (!parsedPayload.success) {
            response.status(400).json({
                error: {
                    code: "INVALID_LOGIN_PAYLOAD",
                    message: "username and password are required"
                }
            });
            return;
        }
        const matchedUser = demoUsers.find((user) => user.username === parsedPayload.data.username && user.password === parsedPayload.data.password);
        if (!matchedUser) {
            response.status(401).json({
                error: {
                    code: "INVALID_CREDENTIALS",
                    message: "Invalid username or password"
                }
            });
            return;
        }
        const accessToken = jwt.sign({
            username: matchedUser.username,
            roles: matchedUser.roles
        }, config.JWT_SECRET, {
            subject: matchedUser.subject,
            expiresIn: "1h"
        });
        response.status(200).json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 3600,
            user: {
                id: matchedUser.subject,
                username: matchedUser.username,
                roles: matchedUser.roles
            }
        });
    });
    app.use((request, response, next) => {
        if (isPublicRoute(request)) {
            next();
            return;
        }
        const authorizationHeader = request.header("authorization");
        if (!authorizationHeader) {
            response.status(401).json({
                error: {
                    code: "AUTH_REQUIRED",
                    message: "Authorization header with Bearer token is required"
                }
            });
            return;
        }
        const [scheme, token] = authorizationHeader.split(" ");
        if (scheme?.toLowerCase() !== "bearer" || !token) {
            response.status(401).json({
                error: {
                    code: "INVALID_AUTH_HEADER",
                    message: "Authorization header must be in the format: Bearer <token>"
                }
            });
            return;
        }
        try {
            const verified = jwt.verify(token, config.JWT_SECRET);
            const parsedClaims = jwtClaimsSchema.safeParse(verified);
            if (!parsedClaims.success) {
                response.status(401).json({
                    error: {
                        code: "INVALID_TOKEN_CLAIMS",
                        message: "Token claims are invalid"
                    }
                });
                return;
            }
            request.user = {
                sub: parsedClaims.data.sub,
                username: parsedClaims.data.username,
                roles: parsedClaims.data.roles
            };
            next();
        }
        catch {
            response.status(401).json({
                error: {
                    code: "INVALID_TOKEN",
                    message: "Token is invalid or expired"
                }
            });
        }
    });
    app.get("/auth/me", (request, response) => {
        response.status(200).json({
            user: request.user
        });
    });
    app.get("/health", (_request, response) => {
        response.status(200).json({
            service: "api-gateway",
            status: "ok"
        });
    });
    return app;
}
