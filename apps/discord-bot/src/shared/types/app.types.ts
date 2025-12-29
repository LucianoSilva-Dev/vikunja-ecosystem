import type { FastifyInstance } from 'fastify';
import type { Client } from 'discord.js';

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, context?: object): void;
  error(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  debug(message: string, context?: object): void;
}

/**
 * Application container holding all dependencies
 */
export interface AppContainer {
  // Core
  logger: ILogger;

  // Discord
  discordClient: Client;

  // Fastify
  httpServer: FastifyInstance;
}
