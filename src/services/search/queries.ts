import { asc, ilike, or, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import { postOffices } from "../../db/schema.js";
import { formatDatabaseResults, type DatabaseSearchRow } from "./formatter.js";
import type { PostalSearchRepository, PostalSearchResult } from "./types.js";

const resultSelection = {
  id: postOffices.id,
  name: postOffices.name,
  postalCode: postOffices.postalCode,
  officeType: postOffices.officeType,
  district: postOffices.district,
  province: postOffices.province,
  address: postOffices.address,
  sourceUrl: postOffices.sourceUrl,
};

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function formatted(rows: DatabaseSearchRow[]): PostalSearchResult[] {
  return formatDatabaseResults(rows);
}

export const postalSearchRepository: PostalSearchRepository = {
  async findByPostalCode(postalCode, fetchLimit) {
    const rows = await db
      .select(resultSelection)
      .from(postOffices)
      .where(sql`${postOffices.postalCode} = ${postalCode}`)
      .orderBy(asc(postOffices.name), asc(postOffices.officeType))
      .limit(fetchLimit);
    return formatted(rows);
  },

  async findByExactName(name, fetchLimit) {
    const rows = await db
      .select(resultSelection)
      .from(postOffices)
      .where(sql`lower(${postOffices.name}) = lower(${name})`)
      .orderBy(asc(postOffices.postalCode), asc(postOffices.officeType))
      .limit(fetchLimit);
    return formatted(rows);
  },

  async findByPartialTerm(term, fetchLimit) {
    const escapedTerm = escapeLikePattern(term);
    const startsWith = `${escapedTerm}%`;
    const contains = `%${escapedTerm}%`;
    const rows = await db
      .select(resultSelection)
      .from(postOffices)
      .where(
        or(
          ilike(postOffices.name, contains),
          ilike(postOffices.district, contains),
          ilike(postOffices.province, contains),
        ),
      )
      .orderBy(
        sql`case
          when ${postOffices.name} ilike ${startsWith} then 1
          when ${postOffices.name} ilike ${contains} then 2
          when ${postOffices.district} ilike ${contains} then 3
          when ${postOffices.province} ilike ${contains} then 4
          else 5
        end`,
        asc(postOffices.name),
        asc(postOffices.postalCode),
      )
      .limit(fetchLimit);
    return formatted(rows);
  },

  async findByDistrict(district, fetchLimit) {
    const escapedDistrict = escapeLikePattern(district);
    const startsWith = `${escapedDistrict}%`;
    const contains = `%${escapedDistrict}%`;
    const rows = await db
      .select(resultSelection)
      .from(postOffices)
      .where(ilike(postOffices.district, contains))
      .orderBy(
        sql`case
          when lower(${postOffices.district}) = lower(${district}) then 1
          when ${postOffices.district} ilike ${startsWith} then 2
          else 3
        end`,
        asc(postOffices.name),
        asc(postOffices.postalCode),
      )
      .limit(fetchLimit);
    return formatted(rows);
  },

  async findByProvince(province, fetchLimit) {
    const escapedProvince = escapeLikePattern(province);
    const startsWith = `${escapedProvince}%`;
    const contains = `%${escapedProvince}%`;
    const rows = await db
      .select(resultSelection)
      .from(postOffices)
      .where(ilike(postOffices.province, contains))
      .orderBy(
        sql`case
          when lower(${postOffices.province}) = lower(${province}) then 1
          when ${postOffices.province} ilike ${startsWith} then 2
          else 3
        end`,
        asc(postOffices.name),
        asc(postOffices.postalCode),
      )
      .limit(fetchLimit);
    return formatted(rows);
  },
};
