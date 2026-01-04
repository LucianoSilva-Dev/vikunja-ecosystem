import {
  getProjects,
  getProjectsId,
  getProjectsIdWebhooks,
  putProjectsIdWebhooks,
  deleteProjectsIdWebhooksWebhookID,
  getTasksId,
  postTasksId,
  getProjectsIdViewsViewTasks,
  putTasksTaskIDAssignees,
  deleteTasksTaskIDAssigneesUserID,
  type ModelsProject,
  type ModelsWebhook,
  type ModelsTask,
  type ModelsTaskBody,
  postLogin,
  getUser,
} from '@vikunja/api-client';
import { VikunjaUser } from '../types/vikunja.types';
import type { ILogger } from '../types';

export type VikunjaProject = ModelsProject;
export type VikunjaWebhook = ModelsWebhook;

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

  // ============ Webhook Operations ============

  /**
   * Lista webhooks de um projeto
   */
  async listProjectWebhooks(projectId: number): Promise<VikunjaWebhook[]> {
    this.logger.debug('Fetching webhooks for project', { projectId });
    try {
      const response = await getProjectsIdWebhooks(
        projectId,
        undefined,
        this.getRequestOptions()
      );
      return response || [];
    } catch (error) {
      this.logger.error('Failed to list project webhooks', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Cria um webhook para um projeto
   */
  async createProjectWebhook(
    projectId: number,
    webhook: {
      targetUrl: string;
      secret: string;
      events: string[];
    }
  ): Promise<VikunjaWebhook> {
    this.logger.debug('Creating webhook for project', { projectId, targetUrl: webhook.targetUrl });
    try {
      const webhookPayload = {
        target_url: webhook.targetUrl,
        secret: webhook.secret || '',
        events: webhook.events,
      } as import('@vikunja/api-client').ModelsWebhook;
      
      const response = await putProjectsIdWebhooks(
        projectId,
        webhookPayload,
        this.getRequestOptions()
      );
      this.logger.info('Webhook created for project', {
        projectId,
        webhookId: response.id,
      });
      return response;
    } catch (error) {
      this.logger.error('Failed to create project webhook', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Remove um webhook de um projeto
   */
  async deleteProjectWebhook(projectId: number, webhookId: number): Promise<void> {
    this.logger.debug('Deleting webhook', { projectId, webhookId });
    try {
      await deleteProjectsIdWebhooksWebhookID(
        projectId,
        webhookId,
        this.getRequestOptions()
      );
      this.logger.info('Webhook deleted', { projectId, webhookId });
    } catch (error) {
      this.logger.error('Failed to delete project webhook', {
        projectId,
        webhookId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Busca um webhook pelo target_url em um projeto
   */
  async findWebhookByTargetUrl(
    projectId: number,
    targetUrl: string
  ): Promise<VikunjaWebhook | null> {
    try {
      const webhooks = await this.listProjectWebhooks(projectId);
      
      // A resposta do Vikunja é convertida para camelCase pelo interceptor
      const found = webhooks.find((w) => {
        const webhookUrl = (w as unknown as { targetUrl?: string }).targetUrl || w.target_url;
        return webhookUrl === targetUrl;
      });
      
      return found || null;
    } catch (error) {
      this.logger.warn('Failed to find webhook by target URL', {
        projectId,
        targetUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
  /**
   * Autentica um usuário e retorna o token JWT
   */
  async authenticate(username: string, password: string): Promise<string> {
    this.logger.debug('Authenticating user', { username });
    try {
      const response = await postLogin({
        username,
        password,
      }, { baseURL: this.apiUrl }); // Login uses base URL, no auth header needed yet
      
      // The response is usually { token: "..." }
      // Checked against common Vikunja API structure
      return (response as any).token;
    } catch (error) {
      this.logger.warn('Authentication failed', {
        username,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Retorna os dados do usuário autenticado pelo token
   */
  async getCurrentUser(token: string): Promise<VikunjaUser> {
    this.logger.debug('Fetching current user info');
    try {
      const response = await getUser({
        baseURL: this.apiUrl,
        headers: { Authorization: `Bearer ${token}` }
      });
      return response as unknown as VikunjaUser;
    } catch (error) {
       this.logger.error('Failed to get current user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ============ Task Operations ============

  /**
   * Busca uma task específica por ID
   */
  async getTaskById(taskId: number): Promise<ModelsTask | null> {
    this.logger.debug('Fetching task by ID', { taskId });
    try {
      const response = await getTasksId(taskId, undefined, this.getRequestOptions());
      return response;
    } catch (error) {
      this.logger.warn('Task not found or error fetching task', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Atualiza uma task
   */
  async updateTask(taskId: number, updates: Partial<ModelsTaskBody>): Promise<ModelsTask> {
    this.logger.debug('Updating task', { taskId, updates });
    try {
      const response = await postTasksId(taskId, updates as ModelsTaskBody, this.getRequestOptions());
      this.logger.info('Task updated', { taskId });
      return response;
    } catch (error) {
      this.logger.error('Failed to update task', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Atribui um usuário a uma task
   */
  async assignTask(taskId: number, userId: number): Promise<void> {
    this.logger.debug('Assigning user to task', { taskId, userId });
    try {
      await putTasksTaskIDAssignees(taskId, { user_id: userId }, this.getRequestOptions());
      this.logger.info('User assigned to task', { taskId, userId });
    } catch (error) {
      this.logger.error('Failed to assign user to task', {
        taskId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Remove atribuição de um usuário de uma task
   */
  async unassignTask(taskId: number, userId: number): Promise<void> {
    this.logger.debug('Unassigning user from task', { taskId, userId });
    try {
      await deleteTasksTaskIDAssigneesUserID(taskId, userId, this.getRequestOptions());
      this.logger.info('User unassigned from task', { taskId, userId });
    } catch (error) {
      this.logger.error('Failed to unassign user from task', {
        taskId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Lista todas as tasks de um projeto
   * Nota: Requer um viewId. Por padrão usamos view 0 (lista).
   */
  async getProjectTasks(projectId: number, viewId: number = 0): Promise<ModelsTask[]> {
    this.logger.debug('Fetching tasks for project', { projectId, viewId });
    try {
      const response = await getProjectsIdViewsViewTasks(projectId, viewId, undefined, this.getRequestOptions());
      return response || [];
    } catch (error) {
      this.logger.error('Failed to get project tasks', {
        projectId,
        viewId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export function createVikunjaApiService(deps: VikunjaApiServiceDeps) {
  return new VikunjaApiService(deps);
}
