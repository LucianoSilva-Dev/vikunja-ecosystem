CREATE TABLE "digests" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_user_id" text NOT NULL,
	"vikunja_project_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"guild_id" text,
	"channel_id" text,
	"cron_expression" text NOT NULL,
	"min_priority" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
