import type { ILogger } from '../../../shared/types';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';

/**
 * Events to register for webhooks.
 * Based on available events from Vikunja API (GET /webhooks/events).
 * Note: 'project.created' does NOT exist in Vikunja's webhook events.
 */
export const DEFAULT_WEBHOOK_EVENTS = [
  // Task events
  'task.created',
  'task.updated',
  'task.deleted',
  'task.assignee.created',
  'task.assignee.deleted',
  'task.comment.created',
  'task.comment.edited',
  'task.comment.deleted',
  'task.attachment.created',
  'task.attachment.deleted',
  'task.relation.created',
  'task.relation.deleted',
  // Project events (note: 'project.created' does not exist!)
  'project.updated',
  'project.deleted',
  'project.shared.team',
  'project.shared.user',
];

export interface WebhookRegistrationServiceDeps {
  logger: ILogger;
  vikunjaApiService: VikunjaApiService;
  webhookCallbackUrl: string;
  webhookSecret: string;
}

export interface WebhookRegistrationResult {
  success: boolean;
  webhookId?: number;
  alreadyExists?: boolean;
  error?: string;
}

export interface SyncResult {
  registered: number[];
  failed: number[];
}

/**
 * Service for managing webhook registration in Vikunja
 */
export class WebhookRegistrationService {
  private readonly logger: ILogger;
  private readonly vikunjaApiService: VikunjaApiService;
  private readonly webhookCallbackUrl: string;
  private readonly webhookSecret: string;

  constructor(deps: WebhookRegistrationServiceDeps) {
    this.logger = deps.logger;
    this.vikunjaApiService = deps.vikunjaApiService;
    this.webhookCallbackUrl = deps.webhookCallbackUrl;
    this.webhookSecret = deps.webhookSecret;
  }

  /**
   * Garante que o webhook existe para um projeto.
   * Se já existir, retorna o existente.
   * Se não existir, cria um novo.
   */
  async ensureWebhookRegistered(projectId: number): Promise<WebhookRegistrationResult> {
    try {
      // Check if webhook already exists
      const existingWebhook = await this.vikunjaApiService.findWebhookByTargetUrl(
        projectId,
        this.webhookCallbackUrl
      );

      if (existingWebhook) {
        this.logger.debug('Webhook already exists for project', {
          projectId,
          webhookId: existingWebhook.id,
        });
        return {
          success: true,
          webhookId: existingWebhook.id,
          alreadyExists: true,
        };
      }

      // Create new webhook
      const newWebhook = await this.vikunjaApiService.createProjectWebhook(
        projectId,
        {
          targetUrl: this.webhookCallbackUrl,
          secret: this.webhookSecret,
          events: DEFAULT_WEBHOOK_EVENTS,
        }
      );

      this.logger.info('Webhook registered for project', {
        projectId,
        webhookId: newWebhook.id,
      });

      return {
        success: true,
        webhookId: newWebhook.id,
        alreadyExists: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to ensure webhook registration', {
        projectId,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Sincroniza webhooks para todos os projetos configurados.
   * Útil para startup ou recovery.
   */
  async syncAllProjectWebhooks(projectIds: number[]): Promise<SyncResult> {
    const registered: number[] = [];
    const failed: number[] = [];

    this.logger.info('Starting webhook sync for projects', {
      count: projectIds.length,
    });

    for (const projectId of projectIds) {
      const result = await this.ensureWebhookRegistered(projectId);
      if (result.success) {
        registered.push(projectId);
      } else {
        failed.push(projectId);
      }
    }

    this.logger.info('Webhook sync completed', {
      registered: registered.length,
      failed: failed.length,
    });

    return { registered, failed };
  }
}

export function createWebhookRegistrationService(
  deps: WebhookRegistrationServiceDeps
): WebhookRegistrationService {
  return new WebhookRegistrationService(deps);
}
