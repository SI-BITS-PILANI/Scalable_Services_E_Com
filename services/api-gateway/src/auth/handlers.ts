import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { config } from "../config.js";
import { demoUsers } from "./demoUsers.js";
import { loginRequestSchema } from "./schemas.js";

export function loginHandler(request: Request, response: Response) {
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

  const matchedUser = demoUsers.find(
    (user) =>
      user.username === parsedPayload.data.username && user.password === parsedPayload.data.password
  );

  if (!matchedUser) {
    response.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password"
      }
    });
    return;
  }

  const accessToken = jwt.sign(
    {
      username: matchedUser.username,
      roles: matchedUser.roles
    },
    config.JWT_SECRET,
    {
      subject: matchedUser.subject,
      expiresIn: "1h"
    }
  );

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
}

export function authMeHandler(request: Request, response: Response) {
  response.status(200).json({
    user: request.user
  });
}
