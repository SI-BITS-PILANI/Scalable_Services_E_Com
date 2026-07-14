import rateLimit from "express-rate-limit";
import { config } from "../config.js";
export function createRateLimiter() {
    return rateLimit({
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
}
