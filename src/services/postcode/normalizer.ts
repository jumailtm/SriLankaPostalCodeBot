import {
  POSTCODE_PDF_URL,
  type NormalizedPostcodeRecord,
  type RawPostcodeRecord,
} from "./types.js";

const DISTRICTS: Readonly<Record<string, string>> = {
  AD: "Anuradhapura",
  APR: "Ampara",
  BC: "Batticaloa",
  BD: "Badulla",
  CO: "Colombo",
  GL: "Galle",
  GQ: "Gampaha",
  HB: "Hambantota",
  JA: "Jaffna",
  KE: "Kegalle",
  KG: "Kurunegala",
  KO: "Kilinochchi",
  KT: "Kalutara",
  KY: "Kandy",
  MB: "Mannar",
  MH: "Matara",
  MJ: "Moneragala",
  MP: "Mullaitivu",
  MT: "Matale",
  NW: "Nuwara Eliya",
  PR: "Polonnaruwa",
  PX: "Puttalam",
  RN: "Ratnapura",
  TC: "Trincomalee",
  VA: "Vavuniya",
};

const PROVINCES: Readonly<Record<string, string>> = {
  SABARA: "Sabaragamuwa",
  WP: "Western Province",
};

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeSourceRecord(source: RawPostcodeRecord): NormalizedPostcodeRecord {
  const warnings: string[] = [];
  let officeLabel = normalizeWhitespace(source.officeLabel);

  const subPostMatch = officeLabel.match(/\(\s*s\s*\)\s*$/i);
  const officeType = subPostMatch === null ? "Post Office" : "Sub Post Office";
  if (subPostMatch !== null) {
    officeLabel = officeLabel.slice(0, subPostMatch.index).trim();
  }

  const districtMatch = officeLabel.match(/(?:\(\s*)?([A-Z]{2,3})\s*\)\s*$/i);
  let districtCode: string | null = null;
  let district: string | null = null;

  if (districtMatch?.index !== undefined) {
    districtCode = districtMatch[1]?.toUpperCase() ?? null;
    officeLabel = officeLabel.slice(0, districtMatch.index).trim();
    district = districtCode === null ? null : (DISTRICTS[districtCode] ?? null);

    if (district === null && districtCode !== null) {
      warnings.push(`Unknown district abbreviation: ${districtCode}`);
    }
  } else {
    warnings.push("Missing or malformed district abbreviation");
  }

  const provinceMatch = officeLabel.match(/\(\s*(SABARA|WP)\s*\)\s*$/i);
  let province: string | null = null;
  if (provinceMatch?.index !== undefined) {
    const provinceCode = provinceMatch[1]?.toUpperCase();
    province = provinceCode === undefined ? null : (PROVINCES[provinceCode] ?? null);
    officeLabel = officeLabel.slice(0, provinceMatch.index).trim();
  }

  if (officeLabel.endsWith("(")) {
    officeLabel = officeLabel.slice(0, -1).trim();
    warnings.push("Removed an unmatched opening parenthesis before the district suffix");
  }

  return {
    record: {
      name: normalizeWhitespace(officeLabel),
      postalCode: source.postalCode.trim(),
      officeType,
      district,
      province,
      address: null,
      sourceUrl: POSTCODE_PDF_URL,
    },
    source,
    districtCode,
    warnings,
  };
}
