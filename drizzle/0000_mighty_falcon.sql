CREATE TABLE "post_offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"postal_code" varchar(5) NOT NULL,
	"office_type" text NOT NULL,
	"district" text,
	"province" text,
	"address" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_offices_name_not_empty" CHECK (length(btrim("post_offices"."name")) > 0),
	CONSTRAINT "post_offices_postal_code_format" CHECK ("post_offices"."postal_code" ~ '^[0-9]{5}$'),
	CONSTRAINT "post_offices_office_type_not_empty" CHECK (length(btrim("post_offices"."office_type")) > 0)
);
--> statement-breakpoint
CREATE INDEX "post_offices_postal_code_idx" ON "post_offices" USING btree ("postal_code");--> statement-breakpoint
CREATE INDEX "post_offices_name_idx" ON "post_offices" USING btree ("name");--> statement-breakpoint
CREATE INDEX "post_offices_district_idx" ON "post_offices" USING btree ("district");--> statement-breakpoint
CREATE INDEX "post_offices_province_idx" ON "post_offices" USING btree ("province");