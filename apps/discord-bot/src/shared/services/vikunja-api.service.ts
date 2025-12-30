import {
  getProjects,
  getProjectsId,
  type ModelsProject,
} from '@vikunja/api-client';
import type { ILogger } from '../types';

export type VikunjaProject = ModelsProject;

export interface VikunjaApiServiceDeps {
  logger: ILogger;
  apiUrl: string;
  apiToken: string;
}

export class VikunjaApiService {
  private readonly logger: ILogger;
  private readonly apiUrl: string;
  private readonly apiToken: string;

  constructor(deps: VikunjaApiServiceDeps) {
    this.logger = deps.logger;
    this.apiUrl = deps.apiUrl;
    this.apiToken = deps.apiToken;
  }

  private getRequestOptions() {
    return {
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    };
  }

  /**
   * Lista todos os projetos acessíveis pelo token configurado
   */
  async listProjects(): Promise<VikunjaProject[]> {
    this.logger.debug('Fetching projects from Vikunja');
    try {
      const response = await getProjects(undefined, this.getRequestOptions());
      return response || [];
    } catch (error) {
      this.logger.error('Failed to list projects', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Busca um projeto específico por ID
   */
  async getProject(projectId: number): Promise<VikunjaProject | null> {
    try {
      const response = await getProjectsId(projectId, this.getRequestOptions());
      return response;
    } catch (error) {
      // Axios throws on 404, we want to return null
      this.logger.warn('Project not found or error fetching project', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

export function createVikunjaApiService(deps: VikunjaApiServiceDeps) {
  return new VikunjaApiService(deps);
}
