import type { PostalSearchResult, SearchResponse } from "../services/search/index.js";

export const START_MESSAGE = `📮 Sri Lanka Postal Code Bot

Search the Sri Lanka Post Postcode Directory by post office name or 5-digit postal code.

Try:
Batticaloa
30000
Kattankudy
batti

This is an independent open-source project, not an official Sri Lanka Post bot.`;

export const HELP_MESSAGE = `Send a search such as:

Batticaloa
30000
Kattankudy
batti
Batticaloa District
Eastern Province`;

export const NO_RESULTS_MESSAGE = `🔎 No matching postal record found.

Please try:

• Post office name
• Partial name
• 5-digit postal code`;

export const EMPTY_INPUT_MESSAGE =
  "Please send a post office name, district, province, or 5-digit postal code.";
export const INVALID_INPUT_MESSAGE =
  "That search is not valid. Please use a post office name or 5-digit postal code.";
export const INPUT_TOO_LONG_MESSAGE = "That search is too long. Please use 100 characters or fewer.";
export const TEMPORARY_ERROR_MESSAGE =
  "The postal search is temporarily unavailable. Please try again later.";
export const RATE_LIMIT_MESSAGE = "You are searching too quickly. Please wait a moment and try again.";

function present(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function formatSingleResult(result: PostalSearchResult): string {
  const lines = ["📮 Postal Code Result", "", `🏤 Post Office: ${result.name}`];

  if (present(result.postalCode)) {
    lines.push(`📮 Postal Code: ${result.postalCode}`);
  }
  if (present(result.officeType)) {
    lines.push(`🏢 Office Type: ${result.officeType}`);
  }
  if (present(result.district)) {
    lines.push(`📍 District: ${result.district}`);
  }
  if (present(result.province)) {
    lines.push(`📍 Province: ${result.province}`);
  }
  if (present(result.address)) {
    lines.push(`🏠 Address: ${result.address}`);
  }

  lines.push("", "Source: Sri Lanka Post Postcode Directory");
  return lines.join("\n");
}

function formatMultipleResults(response: SearchResponse): string {
  const matches = response.results.map(
    (result, index) => `${index + 1}. ${result.name} — ${result.postalCode}`,
  );
  const lines = ["📮 Possible Matches", "", ...matches];

  if (response.hasMore) {
    lines.push("", "Additional matches exist. Please make your search more specific.");
  }

  lines.push("", "Source: Sri Lanka Post Postcode Directory");
  return lines.join("\n");
}

export function formatSearchResponseForTelegram(response: SearchResponse): string {
  if (response.error !== null) {
    if (response.error.code === "empty_query") {
      return EMPTY_INPUT_MESSAGE;
    }
    if (response.error.code === "query_too_long") {
      return INPUT_TOO_LONG_MESSAGE;
    }
    return INVALID_INPUT_MESSAGE;
  }

  if (response.results.length === 0) {
    return NO_RESULTS_MESSAGE;
  }

  const firstResult = response.results[0];
  if (firstResult === undefined) {
    return NO_RESULTS_MESSAGE;
  }

  if (response.results.length === 1) {
    return formatSingleResult(firstResult);
  }

  return formatMultipleResults(response);
}
