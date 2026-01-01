import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ILogger } from '../../../shared/types';
import { webhookPayloadSchema } from '../schemas/webhook.schema';

export interface WebhookRoutesDeps {
  logger: ILogger;
  // webhookService will be injected from app.ts
  onWebhookReceived?: (rawPayload: string, signature: string | undefined) => Promise<void>;
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
 * Creates webhook route registrar
 */
export function createWebhookRoutes(deps: WebhookRoutesDeps) {
  return function registerWebhookRoutes(
    server: FastifyInstance,
    routeDeps: { logger: ILogger }
  ): void {
    server.withTypeProvider<ZodTypeProvider>().post('/webhook', {
      schema: {
        tags: ['webhook'],
        summary: 'Receive Vikunja webhook',
        description:
          'Receives webhook events from Vikunja and processes them for Discord notifications',
        body: webhookPayloadSchema,
        response: {
          200: webhookResponseSchema,
          500: errorResponseSchema,
        },
      },
      handler: async (request, reply) => {
        try {
          const rawPayload = JSON.stringify(request.body);
          const signature = request.headers['x-vikunja-signature'] as
            | string
            | undefined;

          if (deps.onWebhookReceived) {
            await deps.onWebhookReceived(rawPayload, signature);
          }

          return { ok: true };
        } catch (error) {
          routeDeps.logger.error('Webhook processing failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          return reply.status(500).send({ error: 'Processing failed' });
        }
      },
    });

    routeDeps.logger.debug('Webhook routes registered');
  };
}
