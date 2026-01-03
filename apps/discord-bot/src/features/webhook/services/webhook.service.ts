import type { ILogger } from '../../../shared/types';
import type { VikunjaEventType } from '../../../shared/types';
import { webhookPayloadSchema } from '../schemas/webhook.schema';
import type { WebhookEvent, VikunjaEventData } from '../types';
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

    // Cast the event name to our known type (runtime check implicit via schema if schema was stricter, otherwise we trust it or check existence)
    // In strict mode, we might want to check if it represents a known event type.
    // For now, we assume standard Vikunja events.
    
    // We can assume data matches the event structure implicitely or do basic checks
    // Given the complexity of checking all 20+ events with Zod, we will rely on Type safety at the consumption level
    // and basic structure here.
    
    // Construct the WebhookEvent object
    // We treat the data as VikunjaEventData.
    const event: WebhookEvent = {
      event_name: event_name as any, // Cast to union type
      time,
      data: data as any, 
    };

    return event;
  }
}

export function createWebhookService(deps: WebhookServiceDeps): WebhookService {
  return new WebhookService(deps);
}
