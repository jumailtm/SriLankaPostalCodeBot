import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSourceRecord, normalizeWhitespace } from "./normalizer.js";
import type { RawPostcodeRecord, SourceComparison } from "./types.js";
import { detectPossibleDuplicates, isValidPostcode, validateRecords } from "./validator.js";

const emptyComparison: SourceComparison = {
  pdfRecords: 0,
  searchPageRecords: 0,
  pdfOnly: [],
  searchPageOnly: [],
};

function syntheticRecord(
  officeLabel: string,
  postalCode: string,
  rowNumber = 1,
): RawPostcodeRecord {
  return {
    officeLabel,
    postalCode,
    pageNumber: 999,
    rowNumber,
  };
}

test("accepts a valid five-digit postcode", () => {
  assert.equal(isValidPostcode("30000"), true);
});

test("rejects an invalid postcode", () => {
  assert.equal(isValidPostcode("3000A"), false);
  assert.equal(isValidPostcode("3000"), false);
});

test("preserves and accepts a leading-zero postcode", () => {
  const normalized = normalizeSourceRecord(syntheticRecord("Synthetic Office(CO)", "00100"));
  assert.equal(normalized.record.postalCode, "00100");
  assert.equal(isValidPostcode(normalized.record.postalCode), true);
});

test("rejects an empty office name", () => {
  const normalized = normalizeSourceRecord(syntheticRecord("(CO)", "10000"));
  const { report } = validateRecords([normalized], emptyComparison, "2026-01-01T00:00:00.000Z");
  assert.equal(report.invalidRecords, 1);
});

test("normalizes repeated whitespace without changing words", () => {
  assert.equal(normalizeWhitespace("  Synthetic   Office \n Name  "), "Synthetic Office Name");
});

test("reports duplicate-looking records without deleting them", () => {
  const first = normalizeSourceRecord(syntheticRecord("Synthetic Office(CO)(S)", "10000", 1));
  const second = normalizeSourceRecord(syntheticRecord("Synthetic  Office(CO)(S)", "10000", 2));
  const duplicates = detectPossibleDuplicates([first, second]);

  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0]?.records.length, 2);
});

test("reports a malformed source record", () => {
  const normalized = normalizeSourceRecord(syntheticRecord("   ", "ABC"));
  const { report } = validateRecords([normalized], emptyComparison, "2026-01-01T00:00:00.000Z");

  assert.equal(report.invalidRecords, 1);
  assert.match(report.invalid[0]?.messages.join(" ") ?? "", /Office name|Postal code/);
});
