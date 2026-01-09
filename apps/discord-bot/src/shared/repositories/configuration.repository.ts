import { eq, and } from 'drizzle-orm';
import type { Database } from '../../core/database';
import {
  dmConfigurations,
  dmProjectBindings,
  guildConfigurations,
  guildChannelBindings,
} from '../../core/database/schema';
import type { ILogger } from '../types';

export interface ConfigurationRepositoryDeps {
  logger: ILogger;
  db: Database;
}

export interface ProjectBinding {
  projectId: number;
  projectName: string;
  webhookEvents: string[];
}

export class ConfigurationRepository {
  private readonly logger: ILogger;
  private readonly db: Database;

  constructor(deps: ConfigurationRepositoryDeps) {
    this.logger = deps.logger;
    this.db = deps.db;
  }

  // ============ DM Operations ============

  async getDmConfiguration(userId: string) {
    return this.db.query.dmConfigurations.findFirst({
      where: eq(dmConfigurations.userId, userId),
      with: { projectBindings: true },
    });
  }

  async createDmConfiguration(userId: string) {
    const [config] = await this.db
      .insert(dmConfigurations)
      .values({ userId })
      .returning();
    return config;
  }

  async addProjectToDm(userId: string, project: ProjectBinding) {
    let config = await this.getDmConfiguration(userId);
    let configId: number;

    if (!config) {
      const newConfig = await this.createDmConfiguration(userId);
      configId = newConfig.id;
    } else {
      configId = config.id;
    }

    // Check if project already exists
    const existingBindings = await this.db.query.dmProjectBindings.findFirst({
      where: and(
        eq(dmProjectBindings.dmConfigId, configId),
        eq(dmProjectBindings.projectId, project.projectId)
      ),
    });

    if (existingBindings) {
      this.logger.warn('Project already configured for DM', {
        userId,
        projectId: project.projectId,
      });
      return;
    }

    await this.db.insert(dmProjectBindings).values({
      dmConfigId: configId,
      projectId: project.projectId,
      projectName: project.projectName,
      webhookEvents: project.webhookEvents,
    });

    // Update the updatedAt timestamp
    await this.db
      .update(dmConfigurations)
      .set({ updatedAt: new Date() })
      .where(eq(dmConfigurations.id, configId));

    this.logger.info('Added project to DM configuration', {
      userId,
      projectId: project.projectId,
    });
  }

  async removeProjectFromDm(userId: string, projectId: number) {
    const config = await this.getDmConfiguration(userId);
    if (!config) return;

    await this.db
      .delete(dmProjectBindings)
      .where(
        and(
          eq(dmProjectBindings.dmConfigId, config.id),
          eq(dmProjectBindings.projectId, projectId)
        )
      );

    this.logger.info('Removed project from DM configuration', {
      userId,
      projectId,
    });
  }

  async listDmProjects(userId: string) {
    const config = await this.getDmConfiguration(userId);
    if (!config) return [];
    return config.projectBindings;
  }

  // ============ Guild Operations ============

  async getGuildConfiguration(guildId: string) {
    return this.db.query.guildConfigurations.findFirst({
      where: eq(guildConfigurations.guildId, guildId),
      with: { channelBindings: true },
    });
  }

  async createGuildConfiguration(guildId: string) {
    const [config] = await this.db
      .insert(guildConfigurations)
      .values({ guildId })
      .returning();
    return config;
  }

  async addChannelBinding(
    guildId: string,
    channelId: string,
    project: ProjectBinding
  ) {
    let config = await this.getGuildConfiguration(guildId);
    let configId: number;

    if (!config) {
      const newConfig = await this.createGuildConfiguration(guildId);
      configId = newConfig.id;
    } else {
      configId = config.id;
    }

    // Check if this channel already has a project configured
    const existingBinding = await this.db.query.guildChannelBindings.findFirst({
      where: and(
        eq(guildChannelBindings.guildConfigId, configId),
        eq(guildChannelBindings.channelId, channelId)
      ),
    });

    if (existingBinding) {
      // Update the existing binding with the new project
      await this.db
        .update(guildChannelBindings)
        .set({
          projectId: project.projectId,
          projectName: project.projectName,
          webhookEvents: project.webhookEvents,
        })
        .where(eq(guildChannelBindings.id, existingBinding.id));

      this.logger.info('Updated channel binding', {
        guildId,
        channelId,
        projectId: project.projectId,
      });
    } else {
      await this.db.insert(guildChannelBindings).values({
        guildConfigId: configId,
        channelId,
        projectId: project.projectId,
        projectName: project.projectName,
        webhookEvents: project.webhookEvents,
      });

      this.logger.info('Added channel binding', {
        guildId,
        channelId,
        projectId: project.projectId,
      });
    }

    // Update the updatedAt timestamp
    await this.db
      .update(guildConfigurations)
      .set({ updatedAt: new Date() })
      .where(eq(guildConfigurations.id, configId));
  }

  async removeChannelBinding(guildId: string, channelId: string) {
    const config = await this.getGuildConfiguration(guildId);
    if (!config) return;

    await this.db
      .delete(guildChannelBindings)
      .where(
        and(
          eq(guildChannelBindings.guildConfigId, config.id),
          eq(guildChannelBindings.channelId, channelId)
        )
      );

    this.logger.info('Removed channel binding', { guildId, channelId });
  }

  async listGuildChannels(guildId: string) {
    const config = await this.getGuildConfiguration(guildId);
    if (!config) return [];
    return config.channelBindings;
  }

  /**
   * Busca o binding de um canal específico
   */
  async getChannelBinding(guildId: string, channelId: string) {
    const config = await this.getGuildConfiguration(guildId);
    if (!config) return null;

    return this.db.query.guildChannelBindings.findFirst({
      where: and(
        eq(guildChannelBindings.guildConfigId, config.id),
        eq(guildChannelBindings.channelId, channelId)
      ),
    });
  }

  // ============ Query Operations ============

  /**
   * Encontra todos os canais/DMs que devem receber notificação de um projeto
   */
  async findNotificationTargets(
    projectId: number
  ): Promise<Array<{ type: 'dm' | 'channel'; targetId: string; webhookEvents: string[] }>> {
    const targets: Array<{ type: 'dm' | 'channel'; targetId: string; webhookEvents: string[] }> = [];

    // Buscar DMs configuradas para este projeto
    const dmBindings = await this.db.query.dmProjectBindings.findMany({
      where: eq(dmProjectBindings.projectId, projectId),
      with: { dmConfig: true },
    });

    for (const binding of dmBindings) {
      targets.push({
        type: 'dm',
        targetId: binding.dmConfig.userId,
        webhookEvents: binding.webhookEvents ?? [],
      });
    }

    // Buscar canais configurados para este projeto
    const channelBindings = await this.db.query.guildChannelBindings.findMany({
      where: eq(guildChannelBindings.projectId, projectId),
    });

    for (const binding of channelBindings) {
      targets.push({
        type: 'channel',
        targetId: binding.channelId,
        webhookEvents: binding.webhookEvents ?? [],
      });
    }

    return targets;
  }
}

export function createConfigurationRepository(
  deps: ConfigurationRepositoryDeps
) {
  return new ConfigurationRepository(deps);
}
