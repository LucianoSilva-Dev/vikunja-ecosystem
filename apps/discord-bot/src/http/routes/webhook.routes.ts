import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ILogger } from '../../shared/types';
import { createWebhookController } from '../controllers/webhook.controller';
import { webhookPayloadSchema } from '../modules/webhook/webhook.schema';

export interface WebhookRoutesDeps {
  logger: ILogger;
}

/**
 * Response schema for webhook endpoint
 */
const webhookResponseSchema = z.object({
  ok: z.boolean(),
});

/**
 * Error response schema
 */
const errorResponseSchema = z.object({
  error: z.string(),
});

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

  server.withTypeProvider<ZodTypeProvider>().post('/webhook', {
    schema: {
      tags: ['webhook'],
      summary: 'Receive Vikunja webhook',
      description: 'Receives webhook events from Vikunja and processes them for Discord notifications',
      body: webhookPayloadSchema,
      response: {
        200: webhookResponseSchema,
        500: errorResponseSchema,
      },
    },
    handler: webhookHandler,
  });

  deps.logger.debug('Webhook routes registered');
}
