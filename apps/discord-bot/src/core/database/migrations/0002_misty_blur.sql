CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_user_id" text NOT NULL,
	"vikunja_task_id" integer NOT NULL,
	"vikunja_project_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"guild_id" text,
	"cron_expression" text NOT NULL,
	"starts_at" timestamp,
	"next_run_at" timestamp NOT NULL,
	"message" text,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
