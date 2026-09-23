import assert from "node:assert/strict";
import test from "node:test";

import type { Update } from "grammy/types";

import type { WebhookEnvironment } from "../src/config/env.js";
import {
  handleTelegramWebhook,
  isValidWebhookSecret,
} from "./telegram.js";

const environment: WebhookEnvironment = {
  BOT_TOKEN: "test-bot-token",
  DATABASE_URL: "postgresql://database.example.invalid/postcodes",
  NODE_ENV: "test",
  TELEGRAM_WEBHOOK_SECRET: "test_webhook_secret_123",
};

function request(body: string, secret = environment.TELEGRAM_WEBHOOK_SECRET): Request {
  return new Request("https://example.invalid/api/telegram", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body,
  });
}

test("valid webhook secrets compare successfully", () => {
  assert.equal(
    isValidWebhookSecret(environment.TELEGRAM_WEBHOOK_SECRET, environment.TELEGRAM_WEBHOOK_SECRET),
    true,
  );
  assert.equal(isValidWebhookSecret(null, environment.TELEGRAM_WEBHOOK_SECRET), false);
  assert.equal(isValidWebhookSecret("wrong", environment.TELEGRAM_WEBHOOK_SECRET), false);
});

test("a valid webhook update is passed to grammY", async () => {
  const updates: Update[] = [];
  const response = await handleTelegramWebhook(request('{"update_id":1}'), {
    environment,
    bot: {
      async handleUpdate(update) {
        updates.push(update);
      },
    },
  });
  assert.equal(response.status, 200);
  assert.equal(updates[0]?.update_id, 1);
});

test("an invalid webhook secret is rejected before processing", async () => {
  let called = false;
  const response = await handleTelegramWebhook(request('{"update_id":1}', "wrong-secret"), {
    environment,
    bot: {
      async handleUpdate() {
        called = true;
      },
    },
  });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("a missing webhook secret header is rejected", async () => {
  const response = await handleTelegramWebhook(
    new Request("https://example.invalid/api/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"update_id":1}',
    }),
    { environment },
  );
  assert.equal(response.status, 401);
});

test("a malformed webhook request returns HTTP 400", async () => {
  const response = await handleTelegramWebhook(request("not-json"), { environment });
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Malformed Telegram update.");
});

test("a JSON body without an update id returns HTTP 400", async () => {
  const response = await handleTelegramWebhook(request("{}"), { environment });
  assert.equal(response.status, 400);
});

test("non-POST requests return HTTP 405", async () => {
  const response = await handleTelegramWebhook(
    new Request("https://example.invalid/api/telegram", { method: "GET" }),
    { environment },
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("missing runtime configuration returns a generic HTTP 500", async () => {
  const original = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  };
  delete process.env.BOT_TOKEN;
  delete process.env.DATABASE_URL;
  delete process.env.NODE_ENV;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;

  try {
    const response = await handleTelegramWebhook(request('{"update_id":1}'), {
      logger: { error() {} },
    });
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "Service is not configured.");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("grammY processing failures do not expose error details", async () => {
  const sensitiveValue = "sensitive-test-value";
  const logs: string[] = [];
  const response = await handleTelegramWebhook(request('{"update_id":1}'), {
    environment,
    logger: { error: (message) => logs.push(message) },
    bot: {
      async handleUpdate() {
        throw new Error(sensitiveValue);
      },
    },
  });
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.equal(body.includes(sensitiveValue), false);
  assert.deepEqual(logs, ["Telegram webhook processing failed."]);
});
