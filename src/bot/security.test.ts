import assert from "node:assert/strict";
import test from "node:test";

import type { SearchResponse } from "../services/search/index.js";
import { handleSearchMessage, type ReplyContext } from "./handlers.js";
import { INPUT_TOO_LONG_MESSAGE, NO_RESULTS_MESSAGE, TEMPORARY_ERROR_MESSAGE } from "./messages.js";

const noResults: SearchResponse = {
  query: "",
  type: "unknown",
  results: [],
  total: 0,
  hasMore: false,
  suggestions: [],
  error: null,
};

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

async function assertSafeOrdinaryInput(input: string): Promise<void> {
  const { context, messages } = recorder();
  let received = "";
  await handleSearchMessage(context, input, async (query) => {
    received = query;
    return noResults;
  });
  assert.equal(received, input.trim());
  assert.deepEqual(messages, [NO_RESULTS_MESSAGE]);
  assert.equal(messages[0]?.includes(input), false);
}

test("SQL-injection-like text remains inert search input", async () => {
  await assertSafeOrdinaryInput("Robert'); DROP TABLE post_offices;--");
});

test("Telegram-token-like text is not executed or reflected", async () => {
  const tokenLikeInput = `123456:${"A".repeat(35)}`;
  await assertSafeOrdinaryInput(tokenLikeInput);
});

test("database-URL-like text is not executed or reflected", async () => {
  await assertSafeOrdinaryInput("postgresql://database.example.invalid/postcodes");
});

test("HTML-like text is sent through plain-text handling without reflection", async () => {
  await assertSafeOrdinaryInput("<script>alert('test')</script>");
});

test("excessively long text is rejected before database search", async () => {
  const { context, messages } = recorder();
  let called = false;
  await handleSearchMessage(context, "a".repeat(101), async () => {
    called = true;
    return noResults;
  });
  assert.equal(called, false);
  assert.deepEqual(messages, [INPUT_TOO_LONG_MESSAGE]);
});

test("search exception values are never included in user-facing errors", async () => {
  const { context, messages } = recorder();
  const sensitiveValue = "sensitive-test-value";
  await handleSearchMessage(
    context,
    "Batticaloa",
    async () => {
      throw new Error(sensitiveValue);
    },
    { error() {} },
  );
  assert.deepEqual(messages, [TEMPORARY_ERROR_MESSAGE]);
  assert.equal(messages[0]?.includes(sensitiveValue), false);
});
