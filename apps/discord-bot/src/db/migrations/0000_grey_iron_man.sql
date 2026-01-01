CREATE TABLE "dm_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dm_configurations_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dm_project_bindings" (
	"id" serial PRIMARY KEY NOT NULL,
	"dm_config_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"project_name" text NOT NULL,
	"webhook_events" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_channel_bindings" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_config_id" integer NOT NULL,
	"channel_id" text NOT NULL,
	"project_id" integer NOT NULL,
	"project_name" text NOT NULL,
	"webhook_events" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guild_configurations_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
ALTER TABLE "dm_project_bindings" ADD CONSTRAINT "dm_project_bindings_dm_config_id_dm_configurations_id_fk" FOREIGN KEY ("dm_config_id") REFERENCES "public"."dm_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_channel_bindings" ADD CONSTRAINT "guild_channel_bindings_guild_config_id_guild_configurations_id_fk" FOREIGN KEY ("guild_config_id") REFERENCES "public"."guild_configurations"("id") ON DELETE cascade ON UPDATE no action;