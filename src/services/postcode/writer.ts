import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { DatasetMetadata, PostalCodeRecord, ValidationReport } from "./types.js";

const DATA_DIRECTORY = resolve("data");

function csvCell(value: string | null): string {
  if (value === null) {
    return "";
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(records: PostalCodeRecord[]): string {
  const header = [
    "name",
    "postalCode",
    "officeType",
    "district",
    "province",
    "address",
    "sourceUrl",
  ];
  const rows = records.map((record) =>
    [
      record.name,
      record.postalCode,
      record.officeType,
      record.district,
      record.province,
      record.address,
      record.sourceUrl,
    ]
      .map(csvCell)
      .join(","),
  );

  return `${header.join(",")}\n${rows.join("\n")}\n`;
}

async function writeAtomically(fileName: string, content: string): Promise<void> {
  const destination = resolve(DATA_DIRECTORY, fileName);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, destination);
}

export async function writeDataset(
  records: PostalCodeRecord[],
  metadata: DatasetMetadata,
  report: ValidationReport,
): Promise<void> {
  if (records.length === 0) {
    throw new Error("Refusing to write an empty postcode dataset.");
  }

  await mkdir(DATA_DIRECTORY, { recursive: true });
  await Promise.all([
    writeAtomically("postcodes.json", `${JSON.stringify(records, null, 2)}\n`),
    writeAtomically("postcodes.csv", toCsv(records)),
    writeAtomically("postcodes.meta.json", `${JSON.stringify(metadata, null, 2)}\n`),
    writeAtomically("postcodes.validation.json", `${JSON.stringify(report, null, 2)}\n`),
  ]);
}
