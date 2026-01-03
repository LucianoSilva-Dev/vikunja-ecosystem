CREATE TABLE "user_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"vikunja_user_id" integer NOT NULL,
	"vikunja_username" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_mappings_vikunja_user_id_unique" UNIQUE("vikunja_user_id"),
	CONSTRAINT "user_mappings_discord_user_id_unique" UNIQUE("discord_user_id")
);
