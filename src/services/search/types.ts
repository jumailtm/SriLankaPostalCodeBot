import type { OfficeType } from "../postcode/types.js";

export type SearchType =
  | "postal_code"
  | "office_name"
  | "partial_office_name"
  | "district"
  | "province"
  | "unknown";

export type SearchErrorCode =
  | "empty_query"
  | "invalid_query"
  | "invalid_postal_code"
  | "query_too_long"
  | "invalid_limit";

export interface SearchQuery {
  original: string;
  normalized: string;
  searchTerm: string;
  type: SearchType;
}

export interface PostalSearchResult {
  id: string;
  name: string;
  postalCode: string;
  officeType: OfficeType;
  district: string | null;
  province: string | null;
  address: string | null;
  sourceUrl: string | null;
}

export interface SearchValidationError {
  code: SearchErrorCode;
  message: string;
}

export interface SearchResponse {
  query: string;
  type: SearchType;
  results: PostalSearchResult[];
  total: number;
  hasMore: boolean;
  suggestions: string[];
  error: SearchValidationError | null;
}

export interface SearchOptions {
  limit?: number;
}

export interface PostalSearchRepository {
  findByPostalCode(postalCode: string, fetchLimit: number): Promise<PostalSearchResult[]>;
  findByExactName(name: string, fetchLimit: number): Promise<PostalSearchResult[]>;
  findByPartialTerm(term: string, fetchLimit: number): Promise<PostalSearchResult[]>;
  findByDistrict(district: string, fetchLimit: number): Promise<PostalSearchResult[]>;
  findByProvince(province: string, fetchLimit: number): Promise<PostalSearchResult[]>;
}
