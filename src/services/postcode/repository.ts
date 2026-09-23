import { count, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/index.js";
import { postOffices } from "../../db/schema.js";
import type {
  ExistingImportRecord,
  ImportRecord,
  ImportRepository,
} from "./importer.js";

export interface DatabaseVerification {
  totalRecords: number;
  postalCodeDataType: string;
  invalidPostalCodes: number;
  missingNames: number;
  duplicateLogicalRecords: number;
  missingSourceUrls: number;
  officeTypeDistribution: Array<{
    officeType: string;
    count: number;
  }>;
}

const officeTypeSchema = z.enum(["Post Office", "Sub Post Office", "Receiving Post Office"]);
const duplicateCountSchema = z.object({ duplicateGroups: z.coerce.number().int().nonnegative() });
const columnTypeSchema = z.object({ dataType: z.string().min(1) });

export const postcodeRepository: ImportRepository = {
  async loadExisting(): Promise<ExistingImportRecord[]> {
    const rows = await db
      .select({
        id: postOffices.id,
        name: postOffices.name,
        postalCode: postOffices.postalCode,
        officeType: postOffices.officeType,
        district: postOffices.district,
        province: postOffices.province,
        address: postOffices.address,
        sourceUrl: postOffices.sourceUrl,
      })
      .from(postOffices);

    return rows.map((row) => ({
      ...row,
      officeType: officeTypeSchema.parse(row.officeType),
    }));
  },

  async upsert(records: ImportRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    await db
      .insert(postOffices)
      .values(records)
      .onConflictDoUpdate({
        target: [postOffices.name, postOffices.postalCode, postOffices.officeType],
        set: {
          district: sql`excluded."district"`,
          province: sql`excluded."province"`,
          address: sql`excluded."address"`,
          sourceUrl: sql`excluded."source_url"`,
          updatedAt: sql`now()`,
        },
        setWhere: sql`(
          ${postOffices.district},
          ${postOffices.province},
          ${postOffices.address},
          ${postOffices.sourceUrl}
        ) is distinct from (
          excluded."district",
          excluded."province",
          excluded."address",
          excluded."source_url"
        )`,
      });
  },
};

export async function verifyPostcodeDatabase(): Promise<DatabaseVerification> {
  const [summary] = await db
    .select({
      totalRecords: count(),
      invalidPostalCodes: sql<number>`count(*) filter (where ${postOffices.postalCode} !~ '^[0-9]{5}$')::int`,
      missingNames: sql<number>`count(*) filter (where length(btrim(${postOffices.name})) = 0)::int`,
      missingSourceUrls: sql<number>`count(*) filter (
        where ${postOffices.sourceUrl} is null or length(btrim(${postOffices.sourceUrl})) = 0
      )::int`,
    })
    .from(postOffices);

  if (summary === undefined) {
    throw new Error("Database verification returned no summary row.");
  }

  const duplicateResult = await db.execute(sql`
    select count(*)::int as "duplicateGroups"
    from (
      select 1
      from ${postOffices}
      group by ${postOffices.name}, ${postOffices.postalCode}, ${postOffices.officeType}
      having count(*) > 1
    ) duplicate_records
  `);
  const duplicateRow = duplicateCountSchema.parse(duplicateResult.rows[0]);

  const columnTypeResult = await db.execute(sql`
    select data_type as "dataType"
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_offices'
      and column_name = 'postal_code'
  `);
  const columnType = columnTypeSchema.parse(columnTypeResult.rows[0]);

  const distribution = await db
    .select({
      officeType: postOffices.officeType,
      count: count(),
    })
    .from(postOffices)
    .groupBy(postOffices.officeType)
    .orderBy(postOffices.officeType);

  return {
    totalRecords: Number(summary.totalRecords),
    postalCodeDataType: columnType.dataType,
    invalidPostalCodes: Number(summary.invalidPostalCodes),
    missingNames: Number(summary.missingNames),
    duplicateLogicalRecords: duplicateRow.duplicateGroups,
    missingSourceUrls: Number(summary.missingSourceUrls),
    officeTypeDistribution: distribution.map((row) => ({
      officeType: row.officeType,
      count: Number(row.count),
    })),
  };
}
