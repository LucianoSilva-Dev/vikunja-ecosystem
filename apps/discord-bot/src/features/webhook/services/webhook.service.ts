import type { ILogger, VikunjaEventType } from '../../../shared/types';
import {
  webhookPayloadSchema,
  taskDataSchema,
  projectDataSchema,
} from '../schemas/webhook.schema';
import type {
  WebhookEvent,
  TaskEventData,
  ProjectEventData,
} from '../types';
import { WebhookValidator } from '../validators/webhook.validator';

export interface WebhookServiceDeps {
  logger: ILogger;
  webhookSecret: string;
}

/**
 * Service for processing Vikunja webhooks
 */
export class WebhookService {
  private readonly logger: ILogger;
  private readonly validator: WebhookValidator;

  constructor(deps: WebhookServiceDeps) {
    this.logger = deps.logger;
    this.validator = new WebhookValidator({
      logger: deps.logger,
      webhookSecret: deps.webhookSecret,
    });
  }

  /**
   * Processes a webhook payload
   */
  async processWebhook(
    rawPayload: string,
    signature: string | undefined
  ): Promise<WebhookEvent | null> {
    // Validate signature
    const validationResult = this.validator.validateSignature(
      rawPayload,
      signature
    );

    if (!validationResult.valid) {
      this.logger.warn('Webhook signature validation failed', {
        error: validationResult.error,
      });
      return null;
    }

    // Parse and validate payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      this.logger.error('Failed to parse webhook payload');
      return null;
    }

    const parseResult = webhookPayloadSchema.safeParse(payload);
    if (!parseResult.success) {
      this.logger.error('Invalid webhook payload schema', {
        errors: parseResult.error.flatten(),
      });
      return null;
    }

    const { event_name, time, data } = parseResult.data;

    // Map event name to our event type
    const eventType = this.mapEventType(event_name);
    if (!eventType) {
      this.logger.warn('Unknown event type', { event_name });
      return null;
    }

    // Parse event-specific data
    const eventData = this.parseEventData(eventType, data);
    if (!eventData) {
      this.logger.error('Failed to parse event data', { eventType });
      return null;
    }

    return {
      eventType,
      timestamp: new Date(time),
      data: eventData,
    };
  }

  /**
   * Maps Vikunja event names to our event types
   */
  private mapEventType(eventName: string): VikunjaEventType | null {
    const mapping: Record<string, VikunjaEventType> = {
      'task.created': 'task.created',
      'task.updated': 'task.updated',
      'task.deleted': 'task.deleted',
      'task.assignee.created': 'task.assignee.created',
      'task.comment.created': 'task.comment.created',
      'project.created': 'project.created',
      'project.updated': 'project.updated',
      'project.deleted': 'project.deleted',
    };

    return mapping[eventName] || null;
  }

  /**
   * Parses event-specific data based on event type
   */
  private parseEventData(
    eventType: VikunjaEventType,
    data: unknown
  ): TaskEventData | ProjectEventData | null {
    if (eventType.startsWith('task.')) {
      const result = taskDataSchema.safeParse(data);
      if (!result.success) return null;

      return {
        type: 'task',
        id: result.data.id,
        title: result.data.title,
        description: result.data.description,
        done: result.data.done,
        priority: result.data.priority,
        projectId: result.data.project_id,
      };
    }

    if (eventType.startsWith('project.')) {
      const result = projectDataSchema.safeParse(data);
      if (!result.success) return null;

      return {
        type: 'project',
        id: result.data.id,
        title: result.data.title,
        description: result.data.description,
      };
    }

    return null;
  }
}

export function createWebhookService(deps: WebhookServiceDeps): WebhookService {
  return new WebhookService(deps);
}
