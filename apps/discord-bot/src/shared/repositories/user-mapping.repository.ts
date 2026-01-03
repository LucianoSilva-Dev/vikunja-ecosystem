import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../../core/database';
import { userMappings } from '../../core/database/schema';
import type { ILogger } from '../types';

export interface UserMappingRepositoryDeps {
  logger: ILogger;
  db: Database;
}

export class UserMappingRepository {
  private readonly logger: ILogger;
  private readonly db: Database;

  constructor(deps: UserMappingRepositoryDeps) {
    this.logger = deps.logger;
    this.db = deps.db;
  }

  /**
   * Busca o Discord User ID pelo Vikunja User ID
   */
  async findDiscordUserId(vikunjaUserId: number): Promise<string | null> {
    const result = await this.db
      .select({ discordUserId: userMappings.discordUserId })
      .from(userMappings)
      .where(eq(userMappings.vikunjaUserId, vikunjaUserId))
      .limit(1);

    return result[0]?.discordUserId ?? null;
  }

  /**
   * Busca o Vikunja User ID pelo Discord User ID
   */
  async findVikunjaUserId(discordUserId: string): Promise<number | null> {
    const result = await this.db
      .select({ vikunjaUserId: userMappings.vikunjaUserId })
      .from(userMappings)
      .where(eq(userMappings.discordUserId, discordUserId))
      .limit(1);

    return result[0]?.vikunjaUserId ?? null;
  }

  /**
   * Busca mapeamentos para múltiplos usuários Vikunja
   * Retorna um Map de vikunjaUserId -> discordUserId
   */
  async findDiscordUserIds(
    vikunjaUserIds: number[]
  ): Promise<Map<number, string>> {
    if (!vikunjaUserIds.length) return new Map();

    const results = await this.db
      .select({
        vikunjaUserId: userMappings.vikunjaUserId,
        discordUserId: userMappings.discordUserId,
      })
      .from(userMappings)
      .where(inArray(userMappings.vikunjaUserId, vikunjaUserIds));

    return new Map(results.map((r) => [r.vikunjaUserId, r.discordUserId]));
  }

  /**
   * Cria ou atualiza mapeamento de usuário
   */
  async upsertMapping(
    vikunjaUserId: number,
    vikunjaUsername: string,
    discordUserId: string
  ): Promise<void> {
    await this.db
      .insert(userMappings)
      .values({ vikunjaUserId, vikunjaUsername, discordUserId })
      .onConflictDoUpdate({
        target: userMappings.vikunjaUserId,
        set: { vikunjaUsername, discordUserId },
      });

    this.logger.info('User mapping upserted', { vikunjaUserId, discordUserId });
  }

  /**
   * Remove mapeamento de usuário
   */
  async removeMapping(vikunjaUserId: number): Promise<boolean> {
    const result = await this.db
      .delete(userMappings)
      .where(eq(userMappings.vikunjaUserId, vikunjaUserId));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Remove mapeamento por ID do Discord
   */
  async removeMappingByDiscordId(discordUserId: string): Promise<boolean> {
    const result = await this.db
      .delete(userMappings)
      .where(eq(userMappings.discordUserId, discordUserId));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Busca todos os mapeamentos (para debug)
   */
  async findAll(): Promise<
    Array<{
      vikunjaUserId: number;
      vikunjaUsername: string;
      discordUserId: string;
    }>
  > {
    return await this.db
      .select({
        vikunjaUserId: userMappings.vikunjaUserId,
        vikunjaUsername: userMappings.vikunjaUsername,
        discordUserId: userMappings.discordUserId,
      })
      .from(userMappings);
  }
}

export function createUserMappingRepository(
  deps: UserMappingRepositoryDeps
): UserMappingRepository {
  return new UserMappingRepository(deps);
}
