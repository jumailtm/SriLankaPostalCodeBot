import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { DatabaseVerification } from "./repository.js";
import { POSTCODE_PDF_URL } from "./types.js";
import type { ImportSummary } from "./importer.js";

export interface ImportReport extends ImportSummary {
  importedAt: string;
  sourceUrl: string;
  verification: DatabaseVerification | null;
}

export async function writeImportReport(
  summary: ImportSummary,
  verification: DatabaseVerification | null,
): Promise<void> {
  const dataDirectory = resolve("data");
  const destination = resolve(dataDirectory, "import-report.json");
  const temporary = `${destination}.tmp`;
  const report: ImportReport = {
    importedAt: new Date().toISOString(),
    sourceUrl: POSTCODE_PDF_URL,
    ...summary,
    verification,
  };

  await mkdir(dataDirectory, { recursive: true });
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
}
