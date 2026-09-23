import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { POSTCODE_PDF_URL, POSTCODE_SEARCH_URL } from "./types.js";

const RAW_DIRECTORY = resolve("data/raw");
const PDF_PATH = resolve(RAW_DIRECTORY, "POST-CODE-BOOK-.pdf");
const SEARCH_PAGE_PATH = resolve(RAW_DIRECTORY, "postcode-search.html");
const MAX_DOWNLOAD_ATTEMPTS = 3;

export interface OfficialSources {
  pdf: Uint8Array;
  searchPageHtml: string;
  pdfSha256: string;
  searchPageSha256: string;
}

async function download(url: string): Promise<Uint8Array> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "lanka-postcode-bot-source-collector/1.0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "unknown network error";
  throw new Error(`Unable to download official source ${url}: ${reason}`);
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function collectOfficialSources(): Promise<OfficialSources> {
  await mkdir(RAW_DIRECTORY, { recursive: true });

  const [pdf, searchPage] = await Promise.all([
    download(POSTCODE_PDF_URL),
    download(POSTCODE_SEARCH_URL),
  ]);

  if (new TextDecoder("ascii").decode(pdf.slice(0, 5)) !== "%PDF-") {
    throw new Error("The official postcode PDF response is not a valid PDF file.");
  }

  const searchPageHtml = new TextDecoder("utf-8").decode(searchPage);
  if (!searchPageHtml.includes("Search by Post Office")) {
    throw new Error("The official postcode search response has an unexpected structure.");
  }

  await Promise.all([
    writeFile(PDF_PATH, pdf),
    writeFile(SEARCH_PAGE_PATH, searchPage),
  ]);

  return {
    pdf,
    searchPageHtml,
    pdfSha256: sha256(pdf),
    searchPageSha256: sha256(searchPage),
  };
}
