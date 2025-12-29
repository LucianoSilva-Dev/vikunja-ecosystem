import type { FastifyInstance } from 'fastify';
import type { ILogger } from '../../shared/types';
import { registerWebhookRoutes } from './webhook.routes';

export interface RoutesDeps {
  logger: ILogger;
}

/**
 * Registers all HTTP routes
 */
export function registerRoutes(
  server: FastifyInstance,
  deps: RoutesDeps
): void {
  registerWebhookRoutes(server, deps);

  deps.logger.debug('All routes registered');
}
