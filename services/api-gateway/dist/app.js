import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { config } from "./config.js";
export function createApp() {
    const app = express();
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
            }
        },
        apis: []
    });
    app.get("/docs.json", (_request, response) => {
        response.status(200).json(openApiSpec);
    });
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
    app.get("/health", (_request, response) => {
        response.status(200).json({
            service: "api-gateway",
            status: "ok"
        });
    });
    return app;
}
