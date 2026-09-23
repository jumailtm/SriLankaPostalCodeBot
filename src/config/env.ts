import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1, "BOT_TOKEN cannot be empty").optional(),
  ),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must be a PostgreSQL connection string",
    ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = result.data;
