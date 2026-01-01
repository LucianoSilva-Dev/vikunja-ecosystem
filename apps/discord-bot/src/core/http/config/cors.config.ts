import type { FastifyCorsOptions } from '@fastify/cors';

/**
 * CORS configuration for the HTTP server
 */
export const corsConfig: FastifyCorsOptions = {
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Vikunja-Signature'],
  credentials: true,
};
