import { Bot } from "grammy";

import { searchPostalCode } from "../services/search/index.js";
import {
  registerBotHandlers,
  type BotHandlerDependencies,
  type BotLogger,
} from "./handlers.js";
import { InMemoryRateLimiter } from "./rate-limiter.js";

const defaultLogger: BotLogger = {
  error(message) {
    console.error(message);
  },
};

export function createPostalCodeBot(
  token: string,
  dependencies: Partial<BotHandlerDependencies> = {},
): Bot {
  const logger = dependencies.logger ?? defaultLogger;
  const bot = new Bot(token);

  registerBotHandlers(bot, {
    search: dependencies.search ?? searchPostalCode,
    rateLimiter: dependencies.rateLimiter ?? new InMemoryRateLimiter(),
    logger,
  });

  bot.catch(() => {
    logger.error("Unhandled Telegram update error.");
  });

  return bot;
}
