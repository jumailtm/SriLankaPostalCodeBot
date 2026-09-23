import { z } from "zod";

import { classifySearchQuery, normalizeSearchQuery } from "./classifier.js";
import { emptySearchResponse, formatSearchResponse } from "./formatter.js";
import type {
  PostalSearchRepository,
  PostalSearchResult,
  SearchOptions,
  SearchResponse,
  SearchType,
} from "./types.js";

const DEFAULT_RESULT_LIMIT = 10;
const MAX_RESULT_LIMIT = 50;
const MAX_QUERY_LENGTH = 100;
const limitSchema = z.number().int().min(1).max(MAX_RESULT_LIMIT);

function resultTypeForPartialQuery(
  term: string,
  firstResult: PostalSearchResult | undefined,
): SearchType {
  if (firstResult === undefined) {
    return "unknown";
  }

  const comparisonTerm = term.toLocaleLowerCase();
  if (firstResult.name.toLocaleLowerCase().includes(comparisonTerm)) {
    return "partial_office_name";
  }
  if (firstResult.district?.toLocaleLowerCase().includes(comparisonTerm) === true) {
    return "district";
  }
  if (firstResult.province?.toLocaleLowerCase().includes(comparisonTerm) === true) {
    return "province";
  }
  return "unknown";
}

export function createPostalCodeSearch(repository: PostalSearchRepository) {
  return async function search(
    userQuery: string,
    options: SearchOptions = {},
  ): Promise<SearchResponse> {
    const normalized = normalizeSearchQuery(userQuery);
    if (normalized.length === 0) {
      return emptySearchResponse(normalized, {
        code: "empty_query",
        message: "Enter a postal code, post-office name, district, or province.",
      });
    }

    if (normalized.length > MAX_QUERY_LENGTH) {
      return emptySearchResponse(normalized, {
        code: "query_too_long",
        message: `Search queries must be ${MAX_QUERY_LENGTH} characters or fewer.`,
      });
    }

    const limitResult = limitSchema.safeParse(options.limit ?? DEFAULT_RESULT_LIMIT);
    if (!limitResult.success) {
      return emptySearchResponse(normalized, {
        code: "invalid_limit",
        message: `Result limit must be an integer from 1 to ${MAX_RESULT_LIMIT}.`,
      });
    }

    const query = classifySearchQuery(userQuery);
    if (/^\d+$/.test(query.normalized) && query.type !== "postal_code") {
      return emptySearchResponse(query.normalized, {
        code: "invalid_postal_code",
        message: "Postal codes must contain exactly five digits.",
      });
    }

    const limit = limitResult.data;
    const fetchLimit = limit + 1;

    if (query.type === "postal_code") {
      const results = await repository.findByPostalCode(query.searchTerm, fetchLimit);
      return formatSearchResponse(query, "postal_code", results, limit);
    }

    if (query.type === "district") {
      const results = await repository.findByDistrict(query.searchTerm, fetchLimit);
      return formatSearchResponse(query, "district", results, limit);
    }

    if (query.type === "province") {
      const results = await repository.findByProvince(query.searchTerm, fetchLimit);
      return formatSearchResponse(query, "province", results, limit);
    }

    const exactResults = await repository.findByExactName(query.searchTerm, fetchLimit);
    if (exactResults.length > 0) {
      return formatSearchResponse(query, "office_name", exactResults, limit);
    }

    const partialResults = await repository.findByPartialTerm(query.searchTerm, fetchLimit);
    const resolvedType = resultTypeForPartialQuery(query.searchTerm, partialResults[0]);
    return formatSearchResponse(query, resolvedType, partialResults, limit);
  };
}

export async function searchPostalCode(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResponse> {
  const { postalSearchRepository } = await import("./queries.js");
  return createPostalCodeSearch(postalSearchRepository)(query, options);
}
