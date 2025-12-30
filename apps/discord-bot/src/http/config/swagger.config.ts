import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/**
 * Swagger/OpenAPI configuration
 */
export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'Vikunja Discord Bot API',
      description: 'HTTP API for the Vikunja Discord Bot - handles webhooks from Vikunja',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    tags: [
      { name: 'health', description: 'Health check endpoints' },
      { name: 'webhook', description: 'Vikunja webhook endpoints' },
    ],
  },
  transform: jsonSchemaTransform,
};
