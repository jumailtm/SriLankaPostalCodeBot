import type { SearchQuery, SearchType } from "./types.js";

const TRAILING_HARMLESS_PUNCTUATION = /[.,;:!?]+$/u;

export function normalizeSearchQuery(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(TRAILING_HARMLESS_PUNCTUATION, "")
    .trimEnd();
}

function classifiedQuery(
  original: string,
  normalized: string,
  searchTerm: string,
  type: SearchType,
): SearchQuery {
  return { original, normalized, searchTerm, type };
}

export function classifySearchQuery(original: string): SearchQuery {
  const normalized = normalizeSearchQuery(original);

  if (normalized.length === 0) {
    return classifiedQuery(original, normalized, normalized, "unknown");
  }

  if (/^\d{5}$/.test(normalized)) {
    return classifiedQuery(original, normalized, normalized, "postal_code");
  }

  if (/^\d+$/.test(normalized)) {
    return classifiedQuery(original, normalized, normalized, "unknown");
  }

  const districtMatch = normalized.match(/^(.+?)\s+district$/iu);
  if (districtMatch?.[1] !== undefined) {
    return classifiedQuery(original, normalized, districtMatch[1], "district");
  }

  const provinceMatch = normalized.match(/^(.+?)\s+province$/iu);
  if (provinceMatch?.[1] !== undefined) {
    return classifiedQuery(original, normalized, provinceMatch[1], "province");
  }

  return classifiedQuery(original, normalized, normalized, "office_name");
}
