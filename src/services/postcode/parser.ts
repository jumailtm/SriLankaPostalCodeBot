import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { RawPostcodeRecord, SourceComparison } from "./types.js";

const POSTCODE_PATTERN = /^\d{5}$/;
const POSTCODE_COLUMN_MAX_X = 80;
const ENGLISH_COLUMN_MIN_X = 80;
const ENGLISH_COLUMN_MAX_X = 270;
const ROW_Y_TOLERANCE = 0.8;

interface PositionedText {
  text: string;
  x: number;
  y: number;
}

export interface PdfParseResult {
  records: RawPostcodeRecord[];
  pageCount: number;
  dataPages: number[];
}

function normalizeForComparison(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .toLocaleLowerCase("en");
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parsePositionedPage(
  items: PositionedText[],
  pageNumber: number,
): RawPostcodeRecord[] {
  const postcodeItems = items
    .filter((item) => item.x < POSTCODE_COLUMN_MAX_X && POSTCODE_PATTERN.test(item.text.trim()))
    .sort((left, right) => right.y - left.y);

  return postcodeItems.map((postcodeItem, index) => {
    const officeLabel = items
      .filter(
        (item) =>
          item.x >= ENGLISH_COLUMN_MIN_X &&
          item.x < ENGLISH_COLUMN_MAX_X &&
          Math.abs(item.y - postcodeItem.y) <= ROW_Y_TOLERANCE,
      )
      .sort((left, right) => left.x - right.x)
      .map((item) => item.text)
      .join(" ");

    return {
      postalCode: postcodeItem.text.trim(),
      officeLabel,
      pageNumber,
      rowNumber: index + 1,
    };
  });
}

export async function parsePostcodePdf(pdf: Uint8Array): Promise<PdfParseResult> {
  let document;

  try {
    document = await getDocument({ data: pdf, verbosity: 0 }).promise;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown PDF error";
    throw new Error(`Unable to parse the official postcode PDF: ${reason}`);
  }

  const records: RawPostcodeRecord[] = [];
  const dataPages: number[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PositionedText[] = content.items.flatMap((item) => {
      if (!("str" in item) || item.str.trim().length === 0) {
        return [];
      }

      return [
        {
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
        },
      ];
    });
    const pageRecords = parsePositionedPage(items, pageNumber);

    if (pageRecords.length > 0) {
      dataPages.push(pageNumber);
      records.push(...pageRecords);
    }
  }

  if (records.length === 0) {
    throw new Error("The official postcode PDF contained no machine-readable postcode rows.");
  }

  return { records, pageCount: document.numPages, dataPages };
}

export function parsePostcodeSearchPage(html: string): RawPostcodeRecord[] {
  const formEnd = html.indexOf("</form>");
  if (formEnd === -1) {
    throw new Error("The official postcode search page does not contain the expected form.");
  }

  const officeForm = html.slice(0, formEnd);
  const optionPattern = /<option\s+value="(\d{5})">\s*([^<]+?)\s*<\/option>/g;
  const records: RawPostcodeRecord[] = [];

  for (const match of officeForm.matchAll(optionPattern)) {
    const postalCode = match[1];
    const officeLabel = match[2];
    if (postalCode === undefined || officeLabel === undefined) {
      continue;
    }

    records.push({
      postalCode,
      officeLabel: decodeHtmlText(officeLabel),
      pageNumber: 0,
      rowNumber: records.length + 1,
    });
  }

  if (records.length === 0) {
    throw new Error("The official postcode search page contained no office records.");
  }

  return records;
}

export function compareOfficialSources(
  pdfRecords: RawPostcodeRecord[],
  searchPageRecords: RawPostcodeRecord[],
): SourceComparison {
  const toKey = (record: RawPostcodeRecord): string =>
    `${record.postalCode}|${normalizeForComparison(record.officeLabel)}`;
  const pdfKeys = new Set(pdfRecords.map(toKey));
  const searchPageKeys = new Set(searchPageRecords.map(toKey));

  return {
    pdfRecords: pdfRecords.length,
    searchPageRecords: searchPageRecords.length,
    pdfOnly: [...pdfKeys].filter((key) => !searchPageKeys.has(key)).sort(),
    searchPageOnly: [...searchPageKeys].filter((key) => !pdfKeys.has(key)).sort(),
  };
}
