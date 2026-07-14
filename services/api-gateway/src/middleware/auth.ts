import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { jwtClaimsSchema } from "../auth/schemas.js";

function isPublicRoute(request: Request) {
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

export function authMiddleware(request: Request, response: Response, next: NextFunction) {
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
  } catch {
    response.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Token is invalid or expired"
      }
    });
  }
}
