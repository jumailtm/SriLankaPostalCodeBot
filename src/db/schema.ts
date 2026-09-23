import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const postOffices = pgTable(
  "post_offices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    postalCode: varchar("postal_code", { length: 5 }).notNull(),
    officeType: text("office_type").notNull(),
    district: text("district"),
    province: text("province"),
    address: text("address"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("post_offices_name_not_empty", sql`length(btrim(${table.name})) > 0`),
    check("post_offices_postal_code_format", sql`${table.postalCode} ~ '^[0-9]{5}$'`),
    check("post_offices_office_type_not_empty", sql`length(btrim(${table.officeType})) > 0`),
    index("post_offices_postal_code_idx").on(table.postalCode),
    index("post_offices_name_idx").on(table.name),
    index("post_offices_district_idx").on(table.district),
    index("post_offices_province_idx").on(table.province),
    uniqueIndex("post_offices_source_identity_uidx").on(
      table.name,
      table.postalCode,
      table.officeType,
    ),
  ],
);

export type PostOffice = typeof postOffices.$inferSelect;
export type NewPostOffice = typeof postOffices.$inferInsert;
