import type { Bot, Context, NextFunction } from "grammy";

import type { SearchOptions, SearchResponse } from "../services/search/index.js";
import {
  EMPTY_INPUT_MESSAGE,
  HELP_MESSAGE,
  INPUT_TOO_LONG_MESSAGE,
  INVALID_INPUT_MESSAGE,
  RATE_LIMIT_MESSAGE,
  START_MESSAGE,
  TEMPORARY_ERROR_MESSAGE,
  formatSearchResponseForTelegram,
} from "./messages.js";
import { InMemoryRateLimiter } from "./rate-limiter.js";

export const MAX_SEARCH_LENGTH = 100;

export type PostalSearch = (
  query: string,
  options?: SearchOptions,
) => Promise<SearchResponse>;

export interface BotLogger {
  error(message: string): void;
}

export interface ReplyContext {
  reply(text: string): Promise<unknown>;
}

export interface BotHandlerDependencies {
  search: PostalSearch;
  rateLimiter: InMemoryRateLimiter;
  logger?: BotLogger;
}

type InputValidation =
  | { valid: true; value: string }
  | { valid: false; message: string };

const defaultLogger: BotLogger = {
  error(message) {
    console.error(message);
  },
};

export function validateSearchInput(input: string): InputValidation {
  const value = input.normalize("NFC").trim();
  if (value.length === 0) {
    return { valid: false, message: EMPTY_INPUT_MESSAGE };
  }
  if ([...value].length > MAX_SEARCH_LENGTH) {
    return { valid: false, message: INPUT_TOO_LONG_MESSAGE };
  }
  if (/\p{Cc}/u.test(value) || !/[\p{L}\p{N}]/u.test(value)) {
    return { valid: false, message: INVALID_INPUT_MESSAGE };
  }
  return { valid: true, value };
}

export async function safeReply(
  context: ReplyContext,
  message: string,
  logger: BotLogger = defaultLogger,
): Promise<boolean> {
  try {
    await context.reply(message);
    return true;
  } catch {
    logger.error("Unable to send a Telegram response.");
    return false;
  }
}

export async function handleStart(
  context: ReplyContext,
  logger: BotLogger = defaultLogger,
): Promise<void> {
  await safeReply(context, START_MESSAGE, logger);
}

export async function handleHelp(
  context: ReplyContext,
  logger: BotLogger = defaultLogger,
): Promise<void> {
  await safeReply(context, HELP_MESSAGE, logger);
}

export async function handleSearchMessage(
  context: ReplyContext,
  input: string,
  search: PostalSearch,
  logger: BotLogger = defaultLogger,
): Promise<void> {
  const validation = validateSearchInput(input);
  if (!validation.valid) {
    await safeReply(context, validation.message, logger);
    return;
  }

  try {
    const response = await search(validation.value);
    await safeReply(context, formatSearchResponseForTelegram(response), logger);
  } catch {
    logger.error("Postal search failed.");
    await safeReply(context, TEMPORARY_ERROR_MESSAGE, logger);
  }
}

function rateLimitKey(context: Context): string {
  return String(context.from?.id ?? context.chat?.id ?? "unknown");
}

async function enforceRateLimit(
  context: Context,
  next: NextFunction,
  dependencies: BotHandlerDependencies,
): Promise<void> {
  if (context.message === undefined) {
    await next();
    return;
  }

  if (!dependencies.rateLimiter.consume(rateLimitKey(context))) {
    await safeReply(context, RATE_LIMIT_MESSAGE, dependencies.logger ?? defaultLogger);
    return;
  }

  await next();
}

export function registerBotHandlers(
  bot: Bot<Context>,
  dependencies: BotHandlerDependencies,
): void {
  const logger = dependencies.logger ?? defaultLogger;

  bot.use((context, next) => enforceRateLimit(context, next, dependencies));
  bot.command("start", (context) => handleStart(context, logger));
  bot.command("help", (context) => handleHelp(context, logger));
  bot.on("message:text", (context) =>
    handleSearchMessage(context, context.message.text, dependencies.search, logger),
  );
}
