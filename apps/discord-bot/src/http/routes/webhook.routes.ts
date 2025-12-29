import type { FastifyInstance } from 'fastify';
import type { ILogger } from '../../shared/types';
import { createWebhookController } from '../controllers/webhook.controller';

export interface WebhookRoutesDeps {
  logger: ILogger;
}

/**
 * Registers webhook routes
 */
export function registerWebhookRoutes(
  server: FastifyInstance,
  deps: WebhookRoutesDeps
): void {
  const webhookHandler = createWebhookController({
    logger: deps.logger,
  });

  server.post('/webhook', webhookHandler);

  deps.logger.debug('Webhook routes registered');
}
