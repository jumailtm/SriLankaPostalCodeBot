import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAppEnvironment,
  parsePollingEnvironment,
  parseWebhookEnvironment,
} from "./env.js";

const validEnvironment: NodeJS.ProcessEnv = {
  BOT_TOKEN: "test-bot-token",
  DATABASE_URL: "postgresql://database.example.invalid/postcodes",
  NODE_ENV: "test",
  TELEGRAM_WEBHOOK_SECRET: "test_webhook_secret_123",
};

test("accepts a complete webhook environment", () => {
  assert.deepEqual(parseWebhookEnvironment(validEnvironment), validEnvironment);
});

test("reports a missing BOT_TOKEN for polling", () => {
  const { BOT_TOKEN: _omitted, ...environment } = validEnvironment;
  assert.throws(() => parsePollingEnvironment(environment), /BOT_TOKEN is required/u);
});

test("reports a missing DATABASE_URL", () => {
  const { DATABASE_URL: _omitted, ...environment } = validEnvironment;
  assert.throws(() => parseAppEnvironment(environment), /DATABASE_URL is required/u);
});

test("reports a missing webhook secret where webhooks require one", () => {
  const { TELEGRAM_WEBHOOK_SECRET: _omitted, ...environment } = validEnvironment;
  assert.throws(
    () => parseWebhookEnvironment(environment),
    /TELEGRAM_WEBHOOK_SECRET is required/u,
  );
});

test("environment errors do not echo rejected values", () => {
  const rejectedValue = "sensitive-test-value";
  assert.throws(
    () => parseAppEnvironment({ ...validEnvironment, DATABASE_URL: rejectedValue }),
    (error: unknown) => error instanceof Error && !error.message.includes(rejectedValue),
  );
});
