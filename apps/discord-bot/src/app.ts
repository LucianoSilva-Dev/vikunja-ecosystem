import type { FastifyInstance } from 'fastify';
import type { Client } from 'discord.js';

import {
  loadEnv,
  getDiscordConfig,
  getHttpConfig,
  getVikunjaConfig,
} from './shared/config';
import { createLogger } from './shared/logger';
import type { ILogger, AppContainer } from './shared/types';
import { createHttpServer } from './http/server';
import { createDiscordClient } from './bot/client';
import {
  createNotificationService,
  type NotificationService,
} from './bot/modules/notification/notification.service';
import {
  createWebhookService,
  type WebhookService,
} from './http/modules/webhook/webhook.service';

/**
 * Extended app container with all services
 */
export interface App extends AppContainer {
  notificationService: NotificationService;
  webhookService: WebhookService;
}

/**
 * Creates the application container with all dependencies
 * This is the Composition Root - the single place where all dependencies are wired together
 */
export function createApp(): App {
  // Load and validate environment first
  loadEnv();

  // Get configs
  const vikunjaConfig = getVikunjaConfig();

  // Create core dependencies
  const logger = createLogger();

  // Create services
  const notificationService = createNotificationService({ logger });
  const webhookService = createWebhookService({
    logger,
    webhookSecret: vikunjaConfig.webhookSecret,
  });

  // Create Discord client
  const discordClient = createDiscordClient({ logger });

  // Create HTTP server
  const httpServer = createHttpServer({ logger });

  logger.info('Application container created');

  return {
    logger,
    discordClient,
    httpServer,
    notificationService,
    webhookService,
  };
}
