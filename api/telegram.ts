import { timingSafeEqual } from "node:crypto";

import type { Update } from "grammy/types";
import { z } from "zod";

import { createPostalCodeBot } from "../src/bot/index.js";
import {
  parseWebhookEnvironment,
  type WebhookEnvironment,
} from "../src/config/env.js";

const updateSchema = z.object({
  update_id: z.number().int().nonnegative(),
}).passthrough();

interface WebhookBot {
  handleUpdate(update: Update): Promise<void>;
}

interface WebhookLogger {
  error(message: string): void;
}

export interface WebhookDependencies {
  environment?: WebhookEnvironment;
  bot?: WebhookBot;
  logger?: WebhookLogger;
}

const defaultLogger: WebhookLogger = {
  error(message) {
    console.error(message);
  },
};

let cachedBot: WebhookBot | undefined;

function getBot(token: string): WebhookBot {
  cachedBot ??= createPostalCodeBot(token);
  return cachedBot;
}

export function isValidWebhookSecret(received: string | null, expected: string): boolean {
  if (received === null) {
    return false;
  }

  const receivedBytes = Buffer.from(received, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (receivedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(receivedBytes, expectedBytes);
}

export async function handleTelegramWebhook(
  request: Request,
  dependencies: WebhookDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const logger = dependencies.logger ?? defaultLogger;
  let environment: WebhookEnvironment;
  try {
    environment = dependencies.environment ?? parseWebhookEnvironment();
  } catch {
    logger.error("Telegram webhook environment is not configured.");
    return new Response("Service is not configured.", { status: 500 });
  }

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!isValidWebhookSecret(receivedSecret, environment.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Unauthorized.", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Malformed Telegram update.", { status: 400 });
  }

  const parsedUpdate = updateSchema.safeParse(body);
  if (!parsedUpdate.success) {
    return new Response("Malformed Telegram update.", { status: 400 });
  }

  try {
    const bot = dependencies.bot ?? getBot(environment.BOT_TOKEN);
    await bot.handleUpdate(parsedUpdate.data as Update);
    return new Response("OK", { status: 200 });
  } catch {
    logger.error("Telegram webhook processing failed.");
    return new Response("Unable to process Telegram update.", { status: 500 });
  }
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleTelegramWebhook(request);
  },
};
