import type { FastifyInstance, FastifyRequest } from 'fastify';
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

// Extend FastifyRequest to include rawBody
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

/**
 * Creates webhook route registrar
 */
export function createWebhookRoutes(deps: WebhookRoutesDeps) {
  return function registerWebhookRoutes(
    server: FastifyInstance,
    routeDeps: { logger: ILogger }
  ): void {
    // Add a preHandler hook to capture raw body for webhook route
    // This uses addContentTypeParser to store the raw body before Fastify parses it
    server.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (req: FastifyRequest, body: Buffer, done) => {
        // Store raw body for HMAC signature validation
        req.rawBody = body;
        try {
          const json = JSON.parse(body.toString());
          done(null, json);
        } catch (err) {
          done(err as Error, undefined);
        }
      }
    );

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
          // Use rawBody to preserve original payload for signature validation
          // JSON.stringify(request.body) may produce different output than the original
          const rawPayload = request.rawBody?.toString() ?? JSON.stringify(request.body);
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
