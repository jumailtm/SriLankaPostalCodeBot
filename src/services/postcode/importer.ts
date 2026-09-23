import { z } from "zod";

import type { OfficeType } from "./types.js";

const officeTypes = ["Post Office", "Sub Post Office", "Receiving Post Office"] as const;

const nullableTextSchema = z
  .string()
  .nullable()
  .transform((value) => {
    if (value === null) {
      return null;
    }

    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized.length === 0 ? null : normalized;
  });

const officialSourceUrlSchema = z
  .url("sourceUrl must be a valid URL")
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "slpost.gov.lk" || url.hostname.endsWith(".slpost.gov.lk"))
    );
  }, "sourceUrl must use an official Sri Lanka Post HTTPS domain");

const importRecordSchema = z
  .object({
    name: z
      .string({ error: "name is required" })
      .transform((value) => value.trim().replace(/\s+/g, " "))
      .pipe(z.string().min(1, "name must not be empty")),
    postalCode: z
      .string({ error: "postalCode is required" })
      .regex(/^\d{5}$/, "postalCode must contain exactly five digits"),
    officeType: z.enum(officeTypes, { error: "officeType is invalid" }),
    district: nullableTextSchema,
    province: nullableTextSchema,
    address: nullableTextSchema,
    sourceUrl: officialSourceUrlSchema.nullable(),
  })
  .strict();

export interface ImportRecord {
  name: string;
  postalCode: string;
  officeType: OfficeType;
  district: string | null;
  province: string | null;
  address: string | null;
  sourceUrl: string | null;
}

export interface ImportIssue {
  index: number;
  name: string | null;
  postalCode: string | null;
  messages: string[];
}

export interface SourceDuplicate {
  key: string;
  indexes: number[];
}

export interface ParsedImportDataset {
  totalRecords: number;
  validRecords: ImportRecord[];
  importableRecords: ImportRecord[];
  invalidRecords: ImportIssue[];
  duplicates: SourceDuplicate[];
}

export interface ExistingImportRecord extends ImportRecord {
  id: string;
}

export interface ImportPlan {
  insert: ImportRecord[];
  update: ImportRecord[];
  unchanged: ImportRecord[];
}

export interface ImportRepository {
  loadExisting(): Promise<ExistingImportRecord[]>;
  upsert(records: ImportRecord[]): Promise<void>;
}

export interface ImportSummary {
  dryRun: boolean;
  totalSourceRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  invalid: ImportIssue[];
  duplicates: SourceDuplicate[];
}

function describeUnknownRecord(value: unknown): Pick<ImportIssue, "name" | "postalCode"> {
  if (typeof value !== "object" || value === null) {
    return { name: null, postalCode: null };
  }

  const candidate = value as Record<string, unknown>;
  return {
    name: typeof candidate.name === "string" ? candidate.name : null,
    postalCode: typeof candidate.postalCode === "string" ? candidate.postalCode : null,
  };
}

export function logicalRecordKey(record: ImportRecord): string {
  return `${record.name}\u0000${record.postalCode}\u0000${record.officeType}`;
}

function mutableFieldsMatch(left: ImportRecord, right: ImportRecord): boolean {
  return (
    left.district === right.district &&
    left.province === right.province &&
    left.address === right.address &&
    left.sourceUrl === right.sourceUrl
  );
}

export function parseImportDataset(json: string): ParsedImportDataset {
  let input: unknown;

  try {
    input = JSON.parse(json) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown JSON error";
    throw new Error(`Unable to parse data/postcodes.json: ${reason}`);
  }

  if (!Array.isArray(input)) {
    throw new Error("data/postcodes.json must contain a JSON array.");
  }

  if (input.length === 0) {
    throw new Error("data/postcodes.json is empty; refusing to run the import.");
  }

  const validRecords: ImportRecord[] = [];
  const invalidRecords: ImportIssue[] = [];
  const validIndexes: number[] = [];

  input.forEach((value, index) => {
    const result = importRecordSchema.safeParse(value);
    if (result.success) {
      validRecords.push(result.data);
      validIndexes.push(index);
      return;
    }

    invalidRecords.push({
      index,
      ...describeUnknownRecord(value),
      messages: result.error.issues.map((issue) => issue.message),
    });
  });

  const indexesByKey = new Map<string, number[]>();
  validRecords.forEach((record, validIndex) => {
    const key = logicalRecordKey(record);
    const indexes = indexesByKey.get(key) ?? [];
    const sourceIndex = validIndexes[validIndex];
    if (sourceIndex !== undefined) {
      indexes.push(sourceIndex);
    }
    indexesByKey.set(key, indexes);
  });

  const duplicates = [...indexesByKey.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([key, indexes]) => ({ key, indexes }));
  const seenKeys = new Set<string>();
  const importableRecords = validRecords.filter((record) => {
    const key = logicalRecordKey(record);
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });

  return {
    totalRecords: input.length,
    validRecords,
    importableRecords,
    invalidRecords,
    duplicates,
  };
}

export function createImportPlan(
  sourceRecords: ImportRecord[],
  existingRecords: ExistingImportRecord[],
): ImportPlan {
  const existingByKey = new Map<string, ExistingImportRecord>();

  for (const existing of existingRecords) {
    const key = logicalRecordKey(existing);
    if (existingByKey.has(key)) {
      throw new Error(
        "The database contains duplicate logical post-office records. Run postcode:verify before importing.",
      );
    }
    existingByKey.set(key, existing);
  }

  const plan: ImportPlan = { insert: [], update: [], unchanged: [] };
  for (const source of sourceRecords) {
    const existing = existingByKey.get(logicalRecordKey(source));
    if (existing === undefined) {
      plan.insert.push(source);
    } else if (mutableFieldsMatch(source, existing)) {
      plan.unchanged.push(source);
    } else {
      plan.update.push(source);
    }
  }

  return plan;
}

export async function executeImport(
  json: string,
  repository: ImportRepository,
  dryRun: boolean,
): Promise<ImportSummary> {
  const dataset = parseImportDataset(json);
  const existing = await repository.loadExisting();
  const plan = createImportPlan(dataset.importableRecords, existing);
  const recordsToWrite = [...plan.insert, ...plan.update];

  if (!dryRun && recordsToWrite.length > 0) {
    await repository.upsert(recordsToWrite);
  }

  const duplicateRecords = dataset.validRecords.length - dataset.importableRecords.length;
  return {
    dryRun,
    totalSourceRecords: dataset.totalRecords,
    validRecords: dataset.validRecords.length,
    invalidRecords: dataset.invalidRecords.length,
    duplicateRecords,
    inserted: plan.insert.length,
    updated: plan.update.length,
    unchanged: plan.unchanged.length,
    skipped: dataset.invalidRecords.length + duplicateRecords,
    invalid: dataset.invalidRecords,
    duplicates: dataset.duplicates,
  };
}
