import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ILogger } from '../../../shared/types';
import type { VikunjaEventType } from '../../../shared/types/vikunja.types';

import {
  testWebhookRequestSchema,
  testWebhookResponseSchema,
} from '../schemas/test-webhook.schema';
import { createMockWebhookEvent } from '../mocks/test-webhook.mocks';
import type { WebhookEvent } from '../types';

export interface TestWebhookRoutesDeps {
  logger: ILogger;
  /**
   * Callback to handle the parsed test event directly,
   * bypassing signature validation
   */
  onTestEvent?: (event: WebhookEvent) => Promise<void>;
}

/**
 * Error response schema
 */
const errorResponseSchema = z.object({
  error: z.string(),
});

/**
 * Creates test webhook route register
 * Only registers routes when NODE_ENV is 'development'
 */
export function createTestWebhookRoutes(deps: TestWebhookRoutesDeps) {
  return function registerTestWebhookRoutes(
    server: FastifyInstance,
    routeDeps: { logger: ILogger }
  ): void {
    // Only register in development environment
    if (process.env.NODE_ENV !== 'development') {
      routeDeps.logger.debug('Test webhook routes skipped (not in development mode)');
      return;
    }

    server.withTypeProvider<ZodTypeProvider>().post('/webhook/test', {
      schema: {
        tags: ['webhook', 'development'],
        summary: '[DEV] Simulate Vikunja webhook event',
        description:
          'Development-only endpoint to simulate Vikunja webhook events for testing Discord notifications. ' +
          'This endpoint is only available when NODE_ENV=development.',
        body: testWebhookRequestSchema,
        response: {
          200: testWebhookResponseSchema,
          500: errorResponseSchema,
        },
      },
      handler: async (request, reply) => {
        const { projectId, eventType } = request.body;

        try {
          // Create mock event payload
          const mockPayload = createMockWebhookEvent(
            projectId,
            eventType as VikunjaEventType
          );

          routeDeps.logger.info('Test webhook triggered', {
            projectId,
            eventType,
            eventData: mockPayload.data,
          });

          // Create the parsed WebhookEvent directly (bypassing signature validation)
          const parsedEvent: WebhookEvent = {
            event_name: eventType as any,
            time: mockPayload.time,
            data: mockPayload.data as any,
          };

          // Process the event directly (bypassing signature validation)
          if (deps.onTestEvent) {
            await deps.onTestEvent(parsedEvent);
          }

          return {
            ok: true,
            message: `Evento ${eventType} simulado com sucesso para o projeto ${projectId}`,
            event: mockPayload,
          };
        } catch (error) {
          routeDeps.logger.error('Test webhook processing failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          return reply.status(500).send({ error: 'Processing failed' });
        }
      },
    });

    routeDeps.logger.info('Test webhook routes registered (development mode)');
  };
}
