ALTER TABLE "user_mappings" DROP CONSTRAINT "user_mappings_discord_user_id_unique";--> statement-breakpoint
ALTER TABLE "user_mappings" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;