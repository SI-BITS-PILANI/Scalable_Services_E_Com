import { z } from "zod";

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const jwtClaimsSchema = z.object({
  sub: z.string().min(1),
  username: z.string().min(1),
  roles: z.array(z.string())
});
