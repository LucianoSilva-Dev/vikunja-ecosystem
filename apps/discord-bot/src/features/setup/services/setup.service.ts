import type { ILogger } from '../../../shared/types';
import type { ConfigurationRepository } from '../../../shared/repositories/configuration.repository';
import type { VikunjaApiService, VikunjaProject } from '../../../shared/services/vikunja-api.service';

export interface SetupServiceDeps {
  logger: ILogger;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
}

export interface SetupResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Service for handling bot setup operations
 */
export class SetupService {
  private readonly logger: ILogger;
  private readonly configRepository: ConfigurationRepository;
  private readonly vikunjaApiService: VikunjaApiService;

  constructor(deps: SetupServiceDeps) {
    this.logger = deps.logger;
    this.configRepository = deps.configRepository;
    this.vikunjaApiService = deps.vikunjaApiService;
  }

  /**
   * Get available projects from Vikunja API
   */
  async getAvailableProjects(): Promise<SetupResult<VikunjaProject[]>> {
    try {
      const projects = await this.vikunjaApiService.listProjects();
      return { success: true, data: projects };
    } catch (error) {
      this.logger.error('Failed to fetch projects', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: 'Erro ao buscar projetos. Verifique a conexão com o Vikunja.',
      };
    }
  }

  /**
   * Configure DM notifications for a user
   */
  async configureDmNotifications(
    userId: string,
    projectIds: number[]
  ): Promise<SetupResult<number>> {
    try {
      let configuredCount = 0;

      for (const projectId of projectIds) {
        const project = await this.vikunjaApiService.getProject(projectId);

        if (project) {
          await this.configRepository.addProjectToDm(userId, {
            projectId,
            projectName: project.title || `Project ${projectId}`,
            webhookEvents: [],
          });
          configuredCount++;
        }
      }

      this.logger.info('DM notifications configured', {
        userId,
        projectCount: configuredCount,
      });

      return { success: true, data: configuredCount };
    } catch (error) {
      this.logger.error('Failed to configure DM notifications', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: 'Erro ao salvar configurações. Tente novamente.',
      };
    }
  }

  /**
   * Get user's configured DM projects
   */
  async getUserDmProjects(userId: string) {
    return this.configRepository.listDmProjects(userId);
  }
}

export function createSetupService(deps: SetupServiceDeps): SetupService {
  return new SetupService(deps);
}
