import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const requiredString = (name: string) =>
  z.string({ error: `${name} is required` }).min(1, `${name} is required`);

const optionalString = (name: string) =>
  z.preprocess(emptyToUndefined, requiredString(name).optional());

const databaseUrl = requiredString("DATABASE_URL").refine(
  (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
  "DATABASE_URL must be a PostgreSQL connection string",
);

const nodeEnvironment = z.enum(["development", "test", "production"], {
  error: "NODE_ENV must be development, test, or production",
});

const webhookSecret = requiredString("TELEGRAM_WEBHOOK_SECRET")
  .min(16, "TELEGRAM_WEBHOOK_SECRET must be at least 16 characters")
  .max(256, "TELEGRAM_WEBHOOK_SECRET must be at most 256 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "TELEGRAM_WEBHOOK_SECRET may contain only letters, numbers, underscores, and hyphens",
  );

const appEnvironmentSchema = z.object({
  BOT_TOKEN: optionalString("BOT_TOKEN"),
  DATABASE_URL: databaseUrl,
  NODE_ENV: nodeEnvironment,
  TELEGRAM_WEBHOOK_SECRET: optionalString("TELEGRAM_WEBHOOK_SECRET"),
});

const pollingEnvironmentSchema = appEnvironmentSchema.extend({
  BOT_TOKEN: requiredString("BOT_TOKEN"),
});

const webhookEnvironmentSchema = appEnvironmentSchema.extend({
  BOT_TOKEN: requiredString("BOT_TOKEN"),
  TELEGRAM_WEBHOOK_SECRET: webhookSecret,
});

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;
export type PollingEnvironment = z.infer<typeof pollingEnvironmentSchema>;
export type WebhookEnvironment = z.infer<typeof webhookEnvironmentSchema>;

function parseWithSchema<T>(schema: z.ZodType<T>, values: NodeJS.ProcessEnv): T {
  const result = schema.safeParse(values);
  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${details}`);
}

export function parseAppEnvironment(values: NodeJS.ProcessEnv = process.env): AppEnvironment {
  return parseWithSchema(appEnvironmentSchema, values);
}

export function parsePollingEnvironment(
  values: NodeJS.ProcessEnv = process.env,
): PollingEnvironment {
  return parseWithSchema(pollingEnvironmentSchema, values);
}

export function parseWebhookEnvironment(
  values: NodeJS.ProcessEnv = process.env,
): WebhookEnvironment {
  return parseWithSchema(webhookEnvironmentSchema, values);
}
