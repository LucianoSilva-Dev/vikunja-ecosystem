/**
 * Digest Repository
 *
 * CRUD operations for digests table
 */

import { eq, and } from 'drizzle-orm';
import type { Database } from '../../../core/database';
import { digests } from '../../../core/database/schema';
import type { ILogger } from '../../../shared/types';

export interface DigestRecord {
  id: number;
  discordUserId: string;
  vikunjaProjectId: number;
  targetType: 'dm' | 'guild';
  guildId: string | null;
  channelId: string | null;
  cronExpression: string;
  minPriority: number;
  nextRunAt: Date;
  enabled: boolean;
  createdAt: Date;
}

export interface CreateDigestData {
  discordUserId: string;
  vikunjaProjectId: number;
  targetType: 'dm' | 'guild';
  guildId?: string;
  channelId?: string;
  cronExpression: string;
  minPriority: number;
  nextRunAt: Date;
}

export interface DigestRepositoryDeps {
  logger: ILogger;
  db: Database;
}

export class DigestRepository {
  private readonly logger: ILogger;
  private readonly db: Database;

  constructor(deps: DigestRepositoryDeps) {
    this.logger = deps.logger;
    this.db = deps.db;
  }

  /**
   * Create a new digest
   */
  async create(data: CreateDigestData): Promise<DigestRecord> {
    const [result] = await this.db
      .insert(digests)
      .values({
        discordUserId: data.discordUserId,
        vikunjaProjectId: data.vikunjaProjectId,
        targetType: data.targetType,
        guildId: data.guildId || null,
        channelId: data.channelId || null,
        cronExpression: data.cronExpression,
        minPriority: data.minPriority,
        nextRunAt: data.nextRunAt,
        enabled: 1,
      })
      .returning();

    this.logger.info('Digest created', { id: result.id, projectId: data.vikunjaProjectId });

    return this.mapToRecord(result);
  }

  /**
   * Find digest by ID
   */
  async findById(id: number): Promise<DigestRecord | null> {
    const results = await this.db
      .select()
      .from(digests)
      .where(eq(digests.id, id))
      .limit(1);

    return results[0] ? this.mapToRecord(results[0]) : null;
  }

  /**
   * Find all digests for a user
   */
  async findByUserId(discordUserId: string): Promise<DigestRecord[]> {
    const results = await this.db
      .select()
      .from(digests)
      .where(eq(digests.discordUserId, discordUserId));

    return results.map((r) => this.mapToRecord(r));
  }

  /**
   * Find all enabled digests (for loading on startup)
   */
  async findAllEnabled(): Promise<DigestRecord[]> {
    const results = await this.db
      .select()
      .from(digests)
      .where(eq(digests.enabled, 1));

    return results.map((r) => this.mapToRecord(r));
  }

  /**
   * Update next run time
   */
  async updateNextRunAt(id: number, nextRunAt: Date): Promise<void> {
    await this.db
      .update(digests)
      .set({ nextRunAt })
      .where(eq(digests.id, id));
  }

  /**
   * Delete a digest
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(digests)
      .where(eq(digests.id, id));

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      this.logger.info('Digest deleted', { id });
    }
    return deleted;
  }

  private mapToRecord(row: typeof digests.$inferSelect): DigestRecord {
    return {
      id: row.id,
      discordUserId: row.discordUserId,
      vikunjaProjectId: row.vikunjaProjectId,
      targetType: row.targetType,
      guildId: row.guildId,
      channelId: row.channelId,
      cronExpression: row.cronExpression,
      minPriority: row.minPriority,
      nextRunAt: row.nextRunAt,
      enabled: row.enabled === 1,
      createdAt: row.createdAt,
    };
  }
}

export function createDigestRepository(deps: DigestRepositoryDeps): DigestRepository {
  return new DigestRepository(deps);
}
