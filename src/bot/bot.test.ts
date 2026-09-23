import assert from "node:assert/strict";
import test from "node:test";

import type {
  PostalSearchResult,
  SearchResponse,
} from "../services/search/index.js";
import {
  handleHelp,
  handleSearchMessage,
  handleStart,
  type BotLogger,
  type PostalSearch,
  type ReplyContext,
} from "./handlers.js";
import {
  EMPTY_INPUT_MESSAGE,
  HELP_MESSAGE,
  INVALID_INPUT_MESSAGE,
  NO_RESULTS_MESSAGE,
  START_MESSAGE,
  TEMPORARY_ERROR_MESSAGE,
} from "./messages.js";
import { InMemoryRateLimiter } from "./rate-limiter.js";

const baseResult: PostalSearchResult = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Batticaloa",
  postalCode: "30000",
  officeType: "Post Office",
  district: "Batticaloa",
  province: "Eastern",
  address: null,
  sourceUrl: null,
};

function response(
  results: PostalSearchResult[],
  options: { hasMore?: boolean } = {},
): SearchResponse {
  return {
    query: "test",
    type: results.length > 0 ? "office_name" : "unknown",
    results,
    total: results.length,
    hasMore: options.hasMore ?? false,
    suggestions: [],
    error: null,
  };
}

function recorder(): { context: ReplyContext; messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    context: {
      async reply(message) {
        messages.push(message);
      },
    },
  };
}

function fixedSearch(result: SearchResponse): PostalSearch {
  return async () => result;
}

test("/start explains the bot and provides examples", async () => {
  const { context, messages } = recorder();
  await handleStart(context);
  assert.deepEqual(messages, [START_MESSAGE]);
  assert.match(messages[0] ?? "", /independent open-source project/u);
});

test("/help returns concise supported searches", async () => {
  const { context, messages } = recorder();
  await handleHelp(context);
  assert.deepEqual(messages, [HELP_MESSAGE]);
  assert.match(messages[0] ?? "", /30000/u);
});

test("a valid postal code is passed to the search service", async () => {
  const { context, messages } = recorder();
  let received = "";
  await handleSearchMessage(context, " 30000 ", async (query) => {
    received = query;
    return response([baseResult]);
  });
  assert.equal(received, "30000");
  assert.match(messages[0] ?? "", /Postal Code: 30000/u);
});

test("a valid office name is passed to the search service", async () => {
  const { context, messages } = recorder();
  let received = "";
  await handleSearchMessage(context, "Batticaloa", async (query) => {
    received = query;
    return response([baseResult]);
  });
  assert.equal(received, "Batticaloa");
  assert.match(messages[0] ?? "", /Post Office: Batticaloa/u);
});

test("a partial office name is passed without handler-side search logic", async () => {
  const { context } = recorder();
  let received = "";
  await handleSearchMessage(context, "batti", async (query) => {
    received = query;
    return response([baseResult]);
  });
  assert.equal(received, "batti");
});

test("a no-result response uses the fixed no-results message", async () => {
  const { context, messages } = recorder();
  await handleSearchMessage(context, "Missing Office", fixedSearch(response([])));
  assert.deepEqual(messages, [NO_RESULTS_MESSAGE]);
});

test("multiple results are numbered from database values", async () => {
  const { context, messages } = recorder();
  const second = { ...baseResult, name: "Batticaloa South", postalCode: "30100" };
  await handleSearchMessage(context, "Batticaloa", fixedSearch(response([baseResult, second])));
  assert.match(messages[0] ?? "", /1\. Batticaloa — 30000/u);
  assert.match(messages[0] ?? "", /2\. Batticaloa South — 30100/u);
});

test("multiple results disclose when more matches exist", async () => {
  const { context, messages } = recorder();
  const second = { ...baseResult, name: "Batticaloa South", postalCode: "30100" };
  await handleSearchMessage(
    context,
    "Batticaloa",
    fixedSearch(response([baseResult, second], { hasMore: true })),
  );
  assert.match(messages[0] ?? "", /Additional matches exist/u);
});

test("an empty message does not query the search service", async () => {
  const { context, messages } = recorder();
  let called = false;
  await handleSearchMessage(context, "", async () => {
    called = true;
    return response([]);
  });
  assert.equal(called, false);
  assert.deepEqual(messages, [EMPTY_INPUT_MESSAGE]);
});

test("a whitespace-only message does not query the search service", async () => {
  const { context, messages } = recorder();
  let called = false;
  await handleSearchMessage(context, " \t \n ", async () => {
    called = true;
    return response([]);
  });
  assert.equal(called, false);
  assert.deepEqual(messages, [EMPTY_INPUT_MESSAGE]);
});

test("invalid punctuation-only input is rejected", async () => {
  const { context, messages } = recorder();
  let called = false;
  await handleSearchMessage(context, "!!!", async () => {
    called = true;
    return response([]);
  });
  assert.equal(called, false);
  assert.deepEqual(messages, [INVALID_INPUT_MESSAGE]);
});

test("Unicode input remains unchanged", async () => {
  const { context } = recorder();
  let received = "";
  await handleSearchMessage(context, "මහනුවර", async (query) => {
    received = query;
    return response([]);
  });
  assert.equal(received, "මහනුවර");
});

test("database failures return a safe message and a generic server log", async () => {
  const { context, messages } = recorder();
  const logs: string[] = [];
  const logger: BotLogger = { error: (message) => logs.push(message) };
  await handleSearchMessage(
    context,
    "Batticaloa",
    async () => {
      throw new Error("database details must not escape");
    },
    logger,
  );
  assert.deepEqual(messages, [TEMPORARY_ERROR_MESSAGE]);
  assert.deepEqual(logs, ["Postal search failed."]);
});

test("Telegram send errors are contained and logged without details", async () => {
  const logs: string[] = [];
  const logger: BotLogger = { error: (message) => logs.push(message) };
  const context: ReplyContext = {
    async reply() {
      throw new Error("telegram transport details");
    },
  };
  await assert.doesNotReject(handleStart(context, logger));
  assert.deepEqual(logs, ["Unable to send a Telegram response."]);
});

test("the in-memory rate limiter blocks a flood and resets after its window", () => {
  let now = 1_000;
  const limiter = new InMemoryRateLimiter({
    maxRequests: 2,
    windowMs: 500,
    clock: () => now,
  });
  assert.equal(limiter.consume("ephemeral-user"), true);
  assert.equal(limiter.consume("ephemeral-user"), true);
  assert.equal(limiter.consume("ephemeral-user"), false);
  now += 500;
  assert.equal(limiter.consume("ephemeral-user"), true);
});

test("single-result output omits absent optional fields", async () => {
  const { context, messages } = recorder();
  await handleSearchMessage(
    context,
    "Batticaloa",
    fixedSearch(response([{ ...baseResult, district: null, province: null, address: null }])),
  );
  const output = messages[0] ?? "";
  assert.doesNotMatch(output, /District:/u);
  assert.doesNotMatch(output, /Province:/u);
  assert.doesNotMatch(output, /undefined|null/u);
});
