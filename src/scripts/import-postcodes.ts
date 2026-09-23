import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { writeImportReport } from "../services/postcode/import-report.js";
import { executeImport } from "../services/postcode/importer.js";
import {
  postcodeRepository,
  verifyPostcodeDatabase,
} from "../services/postcode/repository.js";

const argumentsProvided = process.argv.slice(2);
const supportedArguments = new Set(["--dry-run"]);
const unknownArguments = argumentsProvided.filter((argument) => !supportedArguments.has(argument));

if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
  process.exitCode = 1;
} else {
  const dryRun = argumentsProvided.includes("--dry-run");

  try {
    const datasetPath = resolve("data/postcodes.json");
    let json: string;
    try {
      json = await readFile(datasetPath, "utf8");
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === "ENOENT") {
        throw new Error("data/postcodes.json was not found. Run npm run postcode:collect first.");
      }
      throw error;
    }

    const summary = await executeImport(json, postcodeRepository, dryRun);
    const verification = dryRun ? null : await verifyPostcodeDatabase();
    await writeImportReport(summary, verification);

    console.log(dryRun ? "Postal Code Import — DRY RUN\n" : "Postal Code Import Complete\n");
    console.log("Source:");
    console.log("Official Sri Lanka Post Postcode Directory\n");
    console.log(`Total source records: ${summary.totalSourceRecords}`);
    console.log(`Valid records: ${summary.validRecords}`);
    console.log(`Invalid records: ${summary.invalidRecords}`);
    console.log(`Source duplicate records: ${summary.duplicateRecords}`);
    console.log(`Inserted: ${summary.inserted}`);
    console.log(`Updated: ${summary.updated}`);
    console.log(`Unchanged: ${summary.unchanged}`);
    console.log(`Skipped: ${summary.skipped}`);

    if (summary.invalid.length > 0) {
      console.log("\nInvalid records:");
      summary.invalid.forEach((issue) => {
        console.log(`${issue.index + 1}. ${issue.messages.join("; ")}`);
      });
    }

    console.log(dryRun ? "\nDatabase changes: NONE" : "\nReport: data/import-report.json");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error";
    console.error(`Postal-code import failed: ${message}`);
    process.exitCode = 1;
  }
}
