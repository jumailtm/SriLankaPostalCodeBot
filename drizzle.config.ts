import "dotenv/config";

import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const databaseUrlSchema = z
  .string({ error: "DATABASE_URL is required" })
  .min(1, "DATABASE_URL is required")
  .refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must be a PostgreSQL connection string",
  );

const databaseUrl = databaseUrlSchema.parse(process.env.DATABASE_URL);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
