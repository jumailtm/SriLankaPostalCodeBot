import assert from "node:assert/strict";
import test from "node:test";

import { createPostalCodeSearch } from "./search.js";
import type {
  PostalSearchRepository,
  PostalSearchResult,
} from "./types.js";

const fixtures: PostalSearchResult[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Batticaloa",
    postalCode: "30000",
    officeType: "Post Office",
    district: "Batticaloa",
    province: null,
    address: null,
    sourceUrl: "https://slpost.gov.lk/official-test-source",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Batticaloa Synthetic Branch",
    postalCode: "30000",
    officeType: "Sub Post Office",
    district: "Batticaloa",
    province: null,
    address: null,
    sourceUrl: "https://slpost.gov.lk/official-test-source",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Synthetic Western Office",
    postalCode: "10000",
    officeType: "Post Office",
    district: "Synthetic District",
    province: "Western Province",
    address: null,
    sourceUrl: "https://slpost.gov.lk/official-test-source",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Unicode Ω Office",
    postalCode: "20000",
    officeType: "Post Office",
    district: null,
    province: null,
    address: null,
    sourceUrl: "https://slpost.gov.lk/official-test-source",
  },
];

class MemorySearchRepository implements PostalSearchRepository {
  calls = 0;

  private limited(records: PostalSearchResult[], fetchLimit: number): PostalSearchResult[] {
    return records.slice(0, fetchLimit);
  }

  async findByPostalCode(postalCode: string, fetchLimit: number) {
    this.calls += 1;
    return this.limited(fixtures.filter((record) => record.postalCode === postalCode), fetchLimit);
  }

  async findByExactName(name: string, fetchLimit: number) {
    this.calls += 1;
    const term = name.toLocaleLowerCase();
    return this.limited(
      fixtures.filter((record) => record.name.toLocaleLowerCase() === term),
      fetchLimit,
    );
  }

  async findByPartialTerm(term: string, fetchLimit: number) {
    this.calls += 1;
    const comparison = term.toLocaleLowerCase();
    return this.limited(
      fixtures.filter(
        (record) =>
          record.name.toLocaleLowerCase().includes(comparison) ||
          record.district?.toLocaleLowerCase().includes(comparison) === true ||
          record.province?.toLocaleLowerCase().includes(comparison) === true,
      ),
      fetchLimit,
    );
  }

  async findByDistrict(district: string, fetchLimit: number) {
    this.calls += 1;
    const term = district.toLocaleLowerCase();
    return this.limited(
      fixtures.filter((record) => record.district?.toLocaleLowerCase().includes(term) === true),
      fetchLimit,
    );
  }

  async findByProvince(province: string, fetchLimit: number) {
    this.calls += 1;
    const term = province.toLocaleLowerCase();
    return this.limited(
      fixtures.filter((record) => record.province?.toLocaleLowerCase().includes(term) === true),
      fetchLimit,
    );
  }
}

function service(repository = new MemorySearchRepository()) {
  return { repository, search: createPostalCodeSearch(repository) };
}

test("performs an exact postal-code search without numeric conversion", async () => {
  const { search } = service();
  const response = await search("30000");
  assert.equal(response.type, "postal_code");
  assert.equal(response.results.length, 2);
  assert.equal(response.results[0]?.postalCode, "30000");
});

test("returns validation for an invalid numeric postal code", async () => {
  const { repository, search } = service();
  const response = await search("3000");
  assert.equal(response.error?.code, "invalid_postal_code");
  assert.equal(repository.calls, 0);
});

test("finds an exact office name", async () => {
  const { search } = service();
  const response = await search("Batticaloa");
  assert.equal(response.type, "office_name");
  assert.equal(response.results[0]?.name, "Batticaloa");
});

test("exact office-name search is case-insensitive", async () => {
  const { search } = service();
  const response = await search("BATTICALOA");
  assert.equal(response.results[0]?.name, "Batticaloa");
});

test("falls back to partial office-name search", async () => {
  const { search } = service();
  const response = await search("batti");
  assert.equal(response.type, "partial_office_name");
  assert.ok(response.results.length >= 1);
  assert.ok(response.suggestions.includes("Batticaloa"));
});

test("normalizes leading, trailing, and repeated whitespace", async () => {
  const { search } = service();
  const response = await search("  Batticaloa   ");
  assert.equal(response.query, "Batticaloa");
  assert.equal(response.results[0]?.name, "Batticaloa");
});

test("returns a structured no-result response", async () => {
  const { search } = service();
  const response = await search("No Such Synthetic Office");
  assert.deepEqual(response.results, []);
  assert.equal(response.total, 0);
  assert.equal(response.hasMore, false);
});

test("returns multiple records for one postal code", async () => {
  const { search } = service();
  const response = await search("30000");
  assert.equal(response.total, 2);
});

test("honors the configured result limit", async () => {
  const { search } = service();
  const response = await search("batti", { limit: 1 });
  assert.equal(response.results.length, 1);
  assert.equal(response.total, 1);
});

test("sets hasMore when the repository returns limit plus one", async () => {
  const { search } = service();
  const response = await search("batti", { limit: 1 });
  assert.equal(response.hasMore, true);
});

test("supports explicit district search", async () => {
  const { search } = service();
  const response = await search("Batticaloa District");
  assert.equal(response.type, "district");
  assert.equal(response.results.length, 2);
});

test("supports explicit province search", async () => {
  const { search } = service();
  const response = await search("Western Province");
  assert.equal(response.type, "province");
  assert.equal(response.results[0]?.province, "Western Province");
});

test("preserves and searches Unicode input", async () => {
  const { search } = service();
  const response = await search("Unicode Ω Office");
  assert.equal(response.results[0]?.name, "Unicode Ω Office");
});

test("treats SQL-injection-like input as ordinary search text", async () => {
  const { search } = service();
  const response = await search("'; DROP TABLE post_offices; --");
  assert.equal(response.total, 0);
  assert.equal(response.error, null);
});

test("returns validation for an empty query without querying the repository", async () => {
  const { repository, search } = service();
  const response = await search("   ");
  assert.equal(response.error?.code, "empty_query");
  assert.equal(repository.calls, 0);
});

test("ignores harmless trailing punctuation", async () => {
  const { search } = service();
  const response = await search("Batticaloa,");
  assert.equal(response.results[0]?.name, "Batticaloa");
});
