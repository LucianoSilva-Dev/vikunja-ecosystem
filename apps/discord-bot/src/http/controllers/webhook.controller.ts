import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ILogger } from '../../shared/types';

export interface WebhookControllerDeps {
  logger: ILogger;
  // webhookService and notificationService will be added later
}

/**
 * Creates the webhook controller handler
 */
export function createWebhookController(deps: WebhookControllerDeps) {
  const { logger } = deps;

  return async function handleWebhook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const signature = request.headers['x-vikunja-signature'] as string;

    logger.info('Webhook received', {
      signature: signature ? '[present]' : '[missing]',
      contentType: request.headers['content-type'],
    });

    try {
      // TODO: Validate signature with webhookService
      // TODO: Process event with notificationService

      logger.debug('Webhook payload', { body: request.body });

      reply.status(200).send({ ok: true });
    } catch (error) {
      logger.error('Webhook processing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      reply.status(500).send({ error: 'Internal error' });
    }
  };
}
