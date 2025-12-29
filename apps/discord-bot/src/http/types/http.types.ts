import type { FastifyRequest, FastifyReply } from 'fastify';

export interface WebhookRequestBody {
  event: string;
  data: unknown;
}

export interface WebhookControllerDeps {
  // Will be expanded with services later
}

export type WebhookHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;
