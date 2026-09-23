export const POSTCODE_PDF_URL =
  "https://slpost.gov.lk/wp-content/uploads/2022/11/POST-CODE-BOOK-.pdf";
export const POSTCODE_SEARCH_URL = "https://slpost.gov.lk/postcode_new/";
export const PARSER_VERSION = "1.0.0";

export type OfficeType = "Post Office" | "Sub Post Office" | "Receiving Post Office";

export interface RawPostcodeRecord {
  postalCode: string;
  officeLabel: string;
  pageNumber: number;
  rowNumber: number;
}

export interface PostalCodeRecord {
  name: string;
  postalCode: string;
  officeType: OfficeType | null;
  district: string | null;
  province: string | null;
  address: string | null;
  sourceUrl: string;
}

export interface NormalizedPostcodeRecord {
  record: PostalCodeRecord;
  source: RawPostcodeRecord;
  districtCode: string | null;
  warnings: string[];
}

export interface RecordIssue {
  source: RawPostcodeRecord;
  messages: string[];
}

export interface DuplicateGroup {
  key: string;
  reason: string;
  records: Array<{
    record: PostalCodeRecord;
    source: RawPostcodeRecord;
  }>;
}

export interface SourceComparison {
  pdfRecords: number;
  searchPageRecords: number;
  pdfOnly: string[];
  searchPageOnly: string[];
}

export interface ValidationReport {
  generatedAt: string;
  totalExtractedRecords: number;
  validRecords: number;
  invalidRecords: number;
  recordsWithMissingFields: number;
  missingFields: Record<"officeType" | "district" | "province" | "address", number>;
  possibleDuplicates: number;
  sourceComparison: SourceComparison;
  invalid: RecordIssue[];
  suspicious: RecordIssue[];
  duplicateGroups: DuplicateGroup[];
  sourceNotes: string[];
}

export interface DatasetMetadata {
  collectedAt: string;
  parserVersion: string;
  recordCount: number;
  sources: Array<{
    url: string;
    type: "official-pdf" | "official-search-page";
    purpose: "primary" | "cross-check";
    sha256: string;
  }>;
  fieldsNotPresentInSource: string[];
  notes: string[];
}
