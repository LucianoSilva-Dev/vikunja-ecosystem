import type { ILogger } from '../../../shared/types';
import type { ConfigurationRepository } from '../../../shared/repositories/configuration.repository';
import type { VikunjaApiService, VikunjaProject } from '../../../shared/services/vikunja-api.service';

export interface ProjectsServiceDeps {
  logger: ILogger;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
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

  constructor(deps: ProjectsServiceDeps) {
    this.logger = deps.logger;
    this.configRepository = deps.configRepository;
    this.vikunjaApiService = deps.vikunjaApiService;
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
    projectId: number
  ): Promise<ProjectsResult<void>> {
    try {
      const project = await this.vikunjaApiService.getProject(projectId);

      if (!project) {
        return { success: false, error: 'Projeto não encontrado.' };
      }

      await this.configRepository.addProjectToDm(userId, {
        projectId,
        projectName: project.title || `Project ${projectId}`,
        webhookEvents: [],
      });

      this.logger.info('Project added to DM', { userId, projectId });
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
}

export function createProjectsService(deps: ProjectsServiceDeps): ProjectsService {
  return new ProjectsService(deps);
}
