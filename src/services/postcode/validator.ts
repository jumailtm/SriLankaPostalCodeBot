import { z } from "zod";

import type {
  DuplicateGroup,
  NormalizedPostcodeRecord,
  PostalCodeRecord,
  SourceComparison,
  ValidationReport,
} from "./types.js";

const postcodeRecordSchema = z.object({
  name: z.string().trim().min(1, "Office name must not be empty"),
  postalCode: z.string().regex(/^\d{5}$/, "Postal code must contain exactly five digits"),
  officeType: z.enum(["Post Office", "Sub Post Office", "Receiving Post Office"]).nullable(),
  district: z.string().trim().min(1).nullable(),
  province: z.string().trim().min(1).nullable(),
  address: z.string().trim().min(1).nullable(),
  sourceUrl: z.url(),
});

export function isValidPostcode(value: string): boolean {
  return /^\d{5}$/.test(value);
}

function duplicateKey(record: PostalCodeRecord): string {
  return [record.name.toLocaleLowerCase("en"), record.postalCode, record.officeType ?? ""]
    .join("|");
}

export function detectPossibleDuplicates(
  records: NormalizedPostcodeRecord[],
): DuplicateGroup[] {
  const groups = new Map<string, NormalizedPostcodeRecord[]>();

  for (const record of records) {
    const key = duplicateKey(record.record);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      reason: "Same normalized office name, postal code, and office type",
      records: group.map(({ record, source }) => ({ record, source })),
    }));
}

export function validateRecords(
  normalizedRecords: NormalizedPostcodeRecord[],
  sourceComparison: SourceComparison,
  generatedAt: string,
): { valid: PostalCodeRecord[]; report: ValidationReport } {
  const valid: PostalCodeRecord[] = [];
  const invalid: ValidationReport["invalid"] = [];
  const suspicious: ValidationReport["suspicious"] = [];

  for (const normalized of normalizedRecords) {
    const result = postcodeRecordSchema.safeParse(normalized.record);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({
        source: normalized.source,
        messages: result.error.issues.map((issue) => issue.message),
      });
    }

    if (normalized.warnings.length > 0) {
      suspicious.push({ source: normalized.source, messages: normalized.warnings });
    }
  }

  const duplicateGroups = detectPossibleDuplicates(normalizedRecords);
  const missingFields = {
    officeType: valid.filter((record) => record.officeType === null).length,
    district: valid.filter((record) => record.district === null).length,
    province: valid.filter((record) => record.province === null).length,
    address: valid.filter((record) => record.address === null).length,
  };
  const recordsWithMissingFields = valid.filter(
    (record) =>
      record.officeType === null ||
      record.district === null ||
      record.province === null ||
      record.address === null,
  ).length;

  return {
    valid,
    report: {
      generatedAt,
      totalExtractedRecords: normalizedRecords.length,
      validRecords: valid.length,
      invalidRecords: invalid.length,
      recordsWithMissingFields,
      missingFields,
      possibleDuplicates: duplicateGroups.length,
      sourceComparison,
      invalid,
      suspicious,
      duplicateGroups,
      sourceNotes: [
        "The PDF's English column is used because the current database schema has one name field.",
        "Address is not present in the directory rows and remains null.",
        "Province is populated only when the PDF explicitly includes a province abbreviation.",
        "The image-only Colombo zone reference page is not part of the machine-readable alphabetical office list.",
        "The directory defines (S) as Sub Post; unmarked alphabetical entries are represented as Post Office.",
        "The directory does not provide a distinct machine-readable marker for Receiving Post Offices.",
      ],
    },
  };
}
