/**
 * Reminder Repository
 *
 * CRUD operations for reminders table
 */

import { eq, and, lte } from 'drizzle-orm';
import type { Database } from '../../../core/database';
import { reminders } from '../../../core/database/schema';
import type { ILogger } from '../../../shared/types';

export interface ReminderRecord {
  id: number;
  discordUserId: string;
  vikunjaTaskId: number;
  vikunjaProjectId: number;
  targetType: 'dm' | 'guild';
  guildId: string | null;
  cronExpression: string;
  startsAt: Date | null;
  nextRunAt: Date;
  message: string | null;
  mentionType: 'assignees' | 'everyone';
  enabled: boolean;
  createdAt: Date;
}

export interface CreateReminderData {
  discordUserId: string;
  vikunjaTaskId: number;
  vikunjaProjectId: number;
  targetType: 'dm' | 'guild';
  guildId?: string;
  cronExpression: string;
  startsAt?: Date;
  nextRunAt: Date;
  message?: string;
  mentionType: 'assignees' | 'everyone';
}

export interface ReminderRepositoryDeps {
  logger: ILogger;
  db: Database;
}

export class ReminderRepository {
  private readonly logger: ILogger;
  private readonly db: Database;

  constructor(deps: ReminderRepositoryDeps) {
    this.logger = deps.logger;
    this.db = deps.db;
  }

  /**
   * Create a new reminder
   */
  async create(data: CreateReminderData): Promise<ReminderRecord> {
    const [result] = await this.db
      .insert(reminders)
      .values({
        discordUserId: data.discordUserId,
        vikunjaTaskId: data.vikunjaTaskId,
        vikunjaProjectId: data.vikunjaProjectId,
        targetType: data.targetType,
        guildId: data.guildId || null,
        cronExpression: data.cronExpression,
        startsAt: data.startsAt || null,
        nextRunAt: data.nextRunAt,
        message: data.message || null,
        mentionType: data.mentionType,
        enabled: 1,
      })
      .returning();

    this.logger.info('Reminder created', { id: result.id, taskId: data.vikunjaTaskId });

    return this.mapToRecord(result);
  }

  /**
   * Find reminder by ID
   */
  async findById(id: number): Promise<ReminderRecord | null> {
    const results = await this.db
      .select()
      .from(reminders)
      .where(eq(reminders.id, id))
      .limit(1);

    return results[0] ? this.mapToRecord(results[0]) : null;
  }

  /**
   * Find all reminders for a user
   */
  async findByUserId(discordUserId: string): Promise<ReminderRecord[]> {
    const results = await this.db
      .select()
      .from(reminders)
      .where(eq(reminders.discordUserId, discordUserId));

    return results.map((r) => this.mapToRecord(r));
  }

  /**
   * Find all enabled reminders (for loading on startup)
   */
  async findAllEnabled(): Promise<ReminderRecord[]> {
    const results = await this.db
      .select()
      .from(reminders)
      .where(eq(reminders.enabled, 1));

    return results.map((r) => this.mapToRecord(r));
  }

  /**
   * Find reminders due for execution
   */
  async findDue(): Promise<ReminderRecord[]> {
    const now = new Date();
    const results = await this.db
      .select()
      .from(reminders)
      .where(and(eq(reminders.enabled, 1), lte(reminders.nextRunAt, now)));

    return results.map((r) => this.mapToRecord(r));
  }

  /**
   * Update next run time
   */
  async updateNextRunAt(id: number, nextRunAt: Date): Promise<void> {
    await this.db
      .update(reminders)
      .set({ nextRunAt })
      .where(eq(reminders.id, id));
  }

  /**
   * Disable a reminder
   */
  async disable(id: number): Promise<void> {
    await this.db
      .update(reminders)
      .set({ enabled: 0 })
      .where(eq(reminders.id, id));

    this.logger.debug('Reminder disabled', { id });
  }

  /**
   * Delete a reminder
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(reminders)
      .where(eq(reminders.id, id));

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      this.logger.info('Reminder deleted', { id });
    }
    return deleted;
  }

  /**
   * Find all reminders for a task
   */
  async findByTaskId(vikunjaTaskId: number): Promise<ReminderRecord[]> {
    const results = await this.db
      .select()
      .from(reminders)
      .where(eq(reminders.vikunjaTaskId, vikunjaTaskId));

    return results.map((r) => this.mapToRecord(r));
  }

  /**
   * Delete all reminders for a task
   */
  async deleteByTaskId(vikunjaTaskId: number): Promise<number> {
    const result = await this.db
      .delete(reminders)
      .where(eq(reminders.vikunjaTaskId, vikunjaTaskId));

    return result.rowCount ?? 0;
  }

  private mapToRecord(row: typeof reminders.$inferSelect): ReminderRecord {
    return {
      id: row.id,
      discordUserId: row.discordUserId,
      vikunjaTaskId: row.vikunjaTaskId,
      vikunjaProjectId: row.vikunjaProjectId,
      targetType: row.targetType,
      guildId: row.guildId,
      cronExpression: row.cronExpression,
      startsAt: row.startsAt,
      nextRunAt: row.nextRunAt,
      message: row.message,
      mentionType: (row.mentionType as 'assignees' | 'everyone') || 'assignees',
      enabled: row.enabled === 1,
      createdAt: row.createdAt,
    };
  }
}

export function createReminderRepository(deps: ReminderRepositoryDeps): ReminderRepository {
  return new ReminderRepository(deps);
}
