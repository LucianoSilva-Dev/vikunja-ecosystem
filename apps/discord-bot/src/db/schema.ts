import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Configurações de DM (1 por usuário Discord)
 */
export const dmConfigurations = pgTable('dm_configurations', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // Discord User ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const dmConfigurationsRelations = relations(
  dmConfigurations,
  ({ many }) => ({
    projectBindings: many(dmProjectBindings),
  })
);

/**
 * Projetos vinculados a configurações de DM
 */
export const dmProjectBindings = pgTable('dm_project_bindings', {
  id: serial('id').primaryKey(),
  dmConfigId: integer('dm_config_id')
    .notNull()
    .references(() => dmConfigurations.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').notNull(),
  projectName: text('project_name').notNull(),
  webhookEvents: jsonb('webhook_events').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dmProjectBindingsRelations = relations(
  dmProjectBindings,
  ({ one }) => ({
    dmConfig: one(dmConfigurations, {
      fields: [dmProjectBindings.dmConfigId],
      references: [dmConfigurations.id],
    }),
  })
);

/**
 * Configurações de Guild (1 por servidor Discord)
 */
export const guildConfigurations = pgTable('guild_configurations', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull().unique(), // Discord Guild ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const guildConfigurationsRelations = relations(
  guildConfigurations,
  ({ many }) => ({
    channelBindings: many(guildChannelBindings),
  })
);

/**
 * Canais vinculados a configurações de Guild
 * Cada canal pode ter 1 projeto associado
 */
export const guildChannelBindings = pgTable('guild_channel_bindings', {
  id: serial('id').primaryKey(),
  guildConfigId: integer('guild_config_id')
    .notNull()
    .references(() => guildConfigurations.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull(), // Discord Channel ID
  projectId: integer('project_id').notNull(),
  projectName: text('project_name').notNull(),
  webhookEvents: jsonb('webhook_events').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const guildChannelBindingsRelations = relations(
  guildChannelBindings,
  ({ one }) => ({
    guildConfig: one(guildConfigurations, {
      fields: [guildChannelBindings.guildConfigId],
      references: [guildConfigurations.id],
    }),
  })
);
