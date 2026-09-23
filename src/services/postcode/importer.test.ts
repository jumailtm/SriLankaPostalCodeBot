import assert from "node:assert/strict";
import test from "node:test";

import {
  executeImport,
  logicalRecordKey,
  parseImportDataset,
  type ExistingImportRecord,
  type ImportRecord,
  type ImportRepository,
} from "./importer.js";

const sourceUrl = "https://slpost.gov.lk/example-official-source.pdf";

function syntheticRecord(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    name: "Synthetic Test Office",
    postalCode: "10000",
    officeType: "Post Office",
    district: null,
    province: null,
    address: null,
    sourceUrl,
    ...overrides,
  };
}

class MemoryRepository implements ImportRepository {
  readonly records = new Map<string, ExistingImportRecord>();
  upsertCalls = 0;

  async loadExisting(): Promise<ExistingImportRecord[]> {
    return [...this.records.values()];
  }

  async upsert(records: ImportRecord[]): Promise<void> {
    this.upsertCalls += 1;
    records.forEach((record, index) => {
      const key = logicalRecordKey(record);
      const existing = this.records.get(key);
      this.records.set(key, {
        ...record,
        id: existing?.id ?? `synthetic-id-${this.records.size + index}`,
      });
    });
  }
}

test("accepts a valid import record", () => {
  const dataset = parseImportDataset(JSON.stringify([syntheticRecord()]));
  assert.equal(dataset.validRecords.length, 1);
  assert.equal(dataset.invalidRecords.length, 0);
});

test("rejects an invalid postal code", () => {
  const dataset = parseImportDataset(
    JSON.stringify([syntheticRecord({ postalCode: "1000A" })]),
  );
  assert.equal(dataset.invalidRecords.length, 1);
});

test("rejects a missing office name", () => {
  const dataset = parseImportDataset(JSON.stringify([syntheticRecord({ name: "" })]));
  assert.equal(dataset.invalidRecords.length, 1);
});

test("reports and de-duplicates a logical source duplicate", () => {
  const record = syntheticRecord();
  const dataset = parseImportDataset(JSON.stringify([record, record]));
  assert.equal(dataset.duplicates.length, 1);
  assert.equal(dataset.importableRecords.length, 1);
});

test("a repeated import is unchanged and creates no duplicate", async () => {
  const repository = new MemoryRepository();
  const json = JSON.stringify([syntheticRecord()]);
  const first = await executeImport(json, repository, false);
  const second = await executeImport(json, repository, false);

  assert.equal(first.inserted, 1);
  assert.equal(second.inserted, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.unchanged, 1);
  assert.equal(repository.records.size, 1);
});

test("updates mutable fields on an existing logical record", async () => {
  const repository = new MemoryRepository();
  const original = syntheticRecord({ district: null });
  await executeImport(JSON.stringify([original]), repository, false);

  const changed = syntheticRecord({ district: "Synthetic District" });
  const summary = await executeImport(JSON.stringify([changed]), repository, false);

  assert.equal(summary.inserted, 0);
  assert.equal(summary.updated, 1);
  assert.equal(repository.records.get(logicalRecordKey(changed))?.district, "Synthetic District");
});

test("dry-run mode never writes to the repository", async () => {
  const repository = new MemoryRepository();
  const summary = await executeImport(JSON.stringify([syntheticRecord()]), repository, true);

  assert.equal(summary.inserted, 1);
  assert.equal(repository.upsertCalls, 0);
  assert.equal(repository.records.size, 0);
});

test("rejects malformed JSON", () => {
  assert.throws(() => parseImportDataset("{not valid json"), /Unable to parse/);
});

test("rejects an empty dataset", () => {
  assert.throws(() => parseImportDataset("[]"), /empty/);
});
