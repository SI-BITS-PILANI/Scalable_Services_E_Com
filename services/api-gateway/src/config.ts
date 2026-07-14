import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters long"),
  CATALOG_BASE_URL: z.url({ message: "CATALOG_BASE_URL must be a valid URL" }),
  ORDER_BASE_URL: z.url({ message: "ORDER_BASE_URL must be a valid URL" }),
  PAYMENT_BASE_URL: z.url({ message: "PAYMENT_BASE_URL must be a valid URL" }),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issueMessages = parsed.error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "env";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${issueMessages}`);
}

export const config = parsed.data;

export function getSafeConfigForLog() {
  return {
    PORT: config.PORT,
    CATALOG_BASE_URL: config.CATALOG_BASE_URL,
    ORDER_BASE_URL: config.ORDER_BASE_URL,
    PAYMENT_BASE_URL: config.PAYMENT_BASE_URL,
    RATE_LIMIT_PER_MINUTE: config.RATE_LIMIT_PER_MINUTE,
    JWT_SECRET: "[hidden]"
  };
}
