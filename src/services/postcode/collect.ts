import { normalizeSourceRecord } from "./normalizer.js";
import {
  compareOfficialSources,
  parsePostcodePdf,
  parsePostcodeSearchPage,
} from "./parser.js";
import { collectOfficialSources } from "./source.js";
import {
  PARSER_VERSION,
  POSTCODE_PDF_URL,
  POSTCODE_SEARCH_URL,
  type DatasetMetadata,
} from "./types.js";
import { validateRecords } from "./validator.js";
import { writeDataset } from "./writer.js";

async function collectPostcodes(): Promise<void> {
  console.log("Postal Code Collection\n");
  console.log("Source: Department of Posts, Sri Lanka");

  const collectedAt = new Date().toISOString();
  const sources = await collectOfficialSources();
  const pdfResult = await parsePostcodePdf(sources.pdf);
  const searchPageRecords = parsePostcodeSearchPage(sources.searchPageHtml);
  const sourceComparison = compareOfficialSources(pdfResult.records, searchPageRecords);
  const normalizedRecords = pdfResult.records.map(normalizeSourceRecord);
  const { valid, report } = validateRecords(
    normalizedRecords,
    sourceComparison,
    collectedAt,
  );

  const metadata: DatasetMetadata = {
    collectedAt,
    parserVersion: PARSER_VERSION,
    recordCount: valid.length,
    sources: [
      {
        url: POSTCODE_PDF_URL,
        type: "official-pdf",
        purpose: "primary",
        sha256: sources.pdfSha256,
      },
      {
        url: POSTCODE_SEARCH_URL,
        type: "official-search-page",
        purpose: "cross-check",
        sha256: sources.searchPageSha256,
      },
    ],
    fieldsNotPresentInSource: ["address"],
    notes: report.sourceNotes,
  };

  await writeDataset(valid, metadata, report);

  const mismatchedSourceRows = Math.max(
    sourceComparison.pdfOnly.length,
    sourceComparison.searchPageOnly.length,
  );
  console.log(`PDF pages: ${pdfResult.pageCount}`);
  console.log(`Machine-readable data pages: ${pdfResult.dataPages.length}`);
  console.log(`Records extracted: ${report.totalExtractedRecords}`);
  console.log(`Valid records: ${report.validRecords}`);
  console.log(`Invalid records: ${report.invalidRecords}`);
  console.log(`Records requiring review: ${report.suspicious.length}`);
  console.log(`Possible duplicates: ${report.possibleDuplicates}`);
  console.log(`Cross-source mismatched rows: ${mismatchedSourceRows}`);
  console.log("\nOutput:");
  console.log("data/postcodes.json");
  console.log("data/postcodes.csv");
  console.log("data/postcodes.meta.json");
  console.log("data/postcodes.validation.json");
}

try {
  await collectPostcodes();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown collection error";
  console.error(`Postal-code collection failed: ${message}`);
  process.exitCode = 1;
}
