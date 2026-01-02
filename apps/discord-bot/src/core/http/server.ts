import Fastify, { type FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifyCors from '@fastify/cors';
import scalarApiReference from '@scalar/fastify-api-reference';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ILogger } from '../../shared/types';
import { corsConfig, swaggerConfig, scalarConfig } from './config';

export interface HttpServerDeps {
  logger: ILogger;
}

export interface RouteRegister {
  (server: FastifyInstance, deps: { logger: ILogger }): void;
}

/**
 * Creates and configures the Fastify HTTP server
 */
export async function createHttpServer(
  deps: HttpServerDeps,
  routeRegisters: RouteRegister[] = []
): Promise<FastifyInstance> {
  const { logger } = deps;

  const server = Fastify({
    logger: false, // We use our own logger
  });

  // Set up Zod type provider for schema validation
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // Register CORS
  await server.register(fastifyCors, corsConfig);

  // Register Swagger for OpenAPI spec generation
  await server.register(fastifySwagger, swaggerConfig);

  // Register Scalar API Reference UI
  await server.register(scalarApiReference, scalarConfig);

  // Health check route
  server.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Health check',
        description: 'Returns the health status of the API',
        response: {
          200: z.object({
            status: z.string(),
            timestamp: z.string(),
          }),
        },
      },
    },
    async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    }
  );

  // Register all provided route registers
  for (const register of routeRegisters) {
    register(server, { logger });
  }

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

export type { FastifyInstance };
