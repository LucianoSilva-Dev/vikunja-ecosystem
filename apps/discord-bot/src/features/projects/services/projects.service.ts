import type { ILogger } from '../../../shared/types';
import type { ConfigurationRepository } from '../../../shared/repositories/configuration.repository';
import type { VikunjaApiService, VikunjaProject } from '../../../shared/services/vikunja-api.service';
import type { WebhookRegistrationService } from '../../webhook/services/webhook-registration.service';

export interface ProjectsServiceDeps {
  logger: ILogger;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
  webhookRegistrationService?: WebhookRegistrationService;
}

export interface ProjectsResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Service for managing project bindings
 */
export class ProjectsService {
  private readonly logger: ILogger;
  private readonly configRepository: ConfigurationRepository;
  private readonly vikunjaApiService: VikunjaApiService;
  private readonly webhookRegistrationService?: WebhookRegistrationService;

  constructor(deps: ProjectsServiceDeps) {
    this.logger = deps.logger;
    this.configRepository = deps.configRepository;
    this.vikunjaApiService = deps.vikunjaApiService;
    this.webhookRegistrationService = deps.webhookRegistrationService;
  }

  /**
   * List configured projects for a user's DM
   */
  async listDmProjects(userId: string) {
    return this.configRepository.listDmProjects(userId);
  }

  /**
   * List configured projects for a guild
   */
  async listGuildProjects(guildId: string) {
    return this.configRepository.listGuildChannels(guildId);
  }

  /**
   * Add a project to user's DM notifications
   */
  async addProjectToDm(
    userId: string,
    projectId: number,
    events: string[] = []
  ): Promise<ProjectsResult<void>> {
    try {
      const project = await this.vikunjaApiService.getProject(projectId);

      if (!project) {
        return { success: false, error: 'Projeto não encontrado.' };
      }

      await this.configRepository.addProjectToDm(userId, {
        projectId,
        projectName: project.title || `Project ${projectId}`,
        webhookEvents: events,
      });

      // Register webhook in Vikunja
      await this.webhookRegistrationService?.ensureWebhookRegistered(projectId, events);

      this.logger.info('Project added to DM', { userId, projectId, events });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to add project to DM', {
        userId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: 'Erro ao adicionar projeto.' };
    }
  }

  /**
   * Remove a project from user's DM notifications
   */
  async removeProjectFromDm(
    userId: string,
    projectId: number
  ): Promise<ProjectsResult<void>> {
    try {
      await this.configRepository.removeProjectFromDm(userId, projectId);
      this.logger.info('Project removed from DM', { userId, projectId });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to remove project from DM', {
        userId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: 'Erro ao remover projeto.' };
    }
  }

  /**
   * Get available projects from Vikunja
   */
  async getAvailableProjects(): Promise<ProjectsResult<VikunjaProject[]>> {
    try {
      const projects = await this.vikunjaApiService.listProjects();
      return { success: true, data: projects };
    } catch (error) {
      this.logger.error('Failed to fetch projects', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: 'Erro ao buscar projetos.',
      };
    }
  }

  /**
   * Get available webhook events for a project
   */
  async getProjectEvents(projectId: number): Promise<ProjectsResult<string[]>> {
    try {
      const events = await this.vikunjaApiService.getProjectAvailableEvents(projectId);
      return { success: true, data: events };
    } catch (error) {
      this.logger.error('Failed to fetch project events', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: 'Erro ao buscar eventos do projeto.',
      };
    }
  }

  // ============ Guild Operations ============

  /**
   * Add a project to a guild channel
   */
  async addProjectToChannel(
    guildId: string,
    channelId: string,
    projectId: number,
    events: string[] = []
  ): Promise<ProjectsResult<void>> {
    try {
      const project = await this.vikunjaApiService.getProject(projectId);

      if (!project) {
        return { success: false, error: 'Projeto não encontrado.' };
      }

      await this.configRepository.addChannelBinding(guildId, channelId, {
        projectId,
        projectName: project.title || `Project ${projectId}`,
        webhookEvents: events,
      });

      // Register webhook in Vikunja
      await this.webhookRegistrationService?.ensureWebhookRegistered(projectId, events);

      this.logger.info('Project added to channel', { guildId, channelId, projectId, events });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to add project to channel', {
        guildId,
        channelId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: 'Erro ao adicionar projeto ao canal.' };
    }
  }

  /**
   * Remove a project from a guild channel
   */
  async removeProjectFromChannel(
    guildId: string,
    channelId: string
  ): Promise<ProjectsResult<void>> {
    try {
      await this.configRepository.removeChannelBinding(guildId, channelId);
      this.logger.info('Project removed from channel', { guildId, channelId });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to remove project from channel', {
        guildId,
        channelId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: 'Erro ao remover projeto do canal.' };
    }
  }

  /**
   * Get the project associated with a channel
   */
  async getProjectByChannel(
    guildId: string,
    channelId: string
  ): Promise<ProjectsResult<{ projectId: number; projectName: string } | null>> {
    try {
      const binding = await this.configRepository.getChannelBinding(guildId, channelId);
      
      if (!binding) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          projectId: binding.projectId,
          projectName: binding.projectName,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get project by channel', {
        guildId,
        channelId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: 'Erro ao buscar projeto do canal.' };
    }
  }
}

export function createProjectsService(deps: ProjectsServiceDeps): ProjectsService {
  return new ProjectsService(deps);
}
