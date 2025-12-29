import Fastify, { type FastifyInstance } from 'fastify';
import type { ILogger } from '../shared/types';
import { registerRoutes } from './routes';

export interface HttpServerDeps {
  logger: ILogger;
}

/**
 * Creates and configures the Fastify HTTP server
 */
export function createHttpServer(deps: HttpServerDeps): FastifyInstance {
  const { logger } = deps;

  const server = Fastify({
    logger: false, // We use our own logger
  });

  // Health check route
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register all routes
  registerRoutes(server, { logger });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Request error', {
      error: errorMessage,
      stack: errorStack,
      url: request.url,
      method: request.method,
    });

    reply.status(500).send({
      error: 'Internal Server Error',
      message: errorMessage,
    });
  });

  return server;
}
