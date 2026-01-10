ALTER TABLE "digests" ADD COLUMN "type" text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "digests" ADD COLUMN "type_data" jsonb;