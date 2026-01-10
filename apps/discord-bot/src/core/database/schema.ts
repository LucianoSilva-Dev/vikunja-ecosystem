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
 * Mapeamento de usuários Vikunja <-> Discord
 */
export const userMappings = pgTable('user_mappings', {
  id: serial('id').primaryKey(),
  vikunjaUserId: integer('vikunja_user_id').notNull().unique(),
  vikunjaUsername: text('vikunja_username').notNull(),
  discordUserId: text('discord_user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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

/**
 * Lembretes de tasks
 * Suporta cron expressions para repetição
 */
export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  discordUserId: text('discord_user_id').notNull(), // Quem criou
  vikunjaTaskId: integer('vikunja_task_id').notNull(),
  vikunjaProjectId: integer('vikunja_project_id').notNull(),
  targetType: text('target_type').notNull().$type<'dm' | 'guild'>(),
  guildId: text('guild_id'), // Para guild reminders
  cronExpression: text('cron_expression').notNull(),
  startsAt: timestamp('starts_at'), // "A partir de" (opcional)
  nextRunAt: timestamp('next_run_at').notNull(),
  message: text('message'), // Mensagem customizada (opcional)
  mentionType: text('mention_type').notNull().default('assignees'), // 'assignees' | 'everyone'
  enabled: integer('enabled').notNull().default(1), // 1 = true, 0 = false
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Resumos de tarefas (Digests)
 */
export const digests = pgTable('digests', {
  id: serial('id').primaryKey(),
  discordUserId: text('discord_user_id').notNull(),
  vikunjaProjectId: integer('vikunja_project_id').notNull(),
  targetType: text('target_type').notNull().$type<'dm' | 'guild'>(),
  guildId: text('guild_id'),
  channelId: text('channel_id'),
  cronExpression: text('cron_expression').notNull(),
  minPriority: integer('min_priority').notNull().default(0),
  nextRunAt: timestamp('next_run_at').notNull(),
  enabled: integer('enabled').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
