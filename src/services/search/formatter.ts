import { z } from "zod";

import type {
  PostalSearchResult,
  SearchQuery,
  SearchResponse,
  SearchType,
  SearchValidationError,
} from "./types.js";

export interface DatabaseSearchRow {
  id: string;
  name: string;
  postalCode: string;
  officeType: string;
  district: string | null;
  province: string | null;
  address: string | null;
  sourceUrl: string | null;
}

const databaseSearchRowSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  postalCode: z.string().regex(/^\d{5}$/),
  officeType: z.enum(["Post Office", "Sub Post Office", "Receiving Post Office"]),
  district: z.string().nullable(),
  province: z.string().nullable(),
  address: z.string().nullable(),
  sourceUrl: z.string().nullable(),
});

export function formatDatabaseResults(rows: DatabaseSearchRow[]): PostalSearchResult[] {
  return rows.map((row) => databaseSearchRowSchema.parse(row));
}

export function emptySearchResponse(
  query: string,
  error: SearchValidationError,
): SearchResponse {
  return {
    query,
    type: "unknown",
    results: [],
    total: 0,
    hasMore: false,
    suggestions: [],
    error,
  };
}

export function formatSearchResponse(
  query: SearchQuery,
  type: SearchType,
  fetchedResults: PostalSearchResult[],
  limit: number,
): SearchResponse {
  const hasMore = fetchedResults.length > limit;
  const results = fetchedResults.slice(0, limit);
  const suggestions =
    type === "partial_office_name"
      ? [...new Set(results.map((result) => result.name))].slice(0, 5)
      : [];

  return {
    query: query.normalized,
    type,
    results,
    total: results.length,
    hasMore,
    suggestions,
    error: null,
  };
}
