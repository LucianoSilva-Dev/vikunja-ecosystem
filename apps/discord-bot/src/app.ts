import {
  loadEnv,
  getVikunjaConfig,
  getDatabaseConfig,
} from './shared/config';
import type { ILogger } from './shared/types';

// Core modules
import { createLogger } from './core/logger';
import { createDatabase, type Database } from './core/database';
import {
  createDiscordClient,
  registerReadyEvent,
  type Client,
} from './core/discord';
import {
  createHttpServer,
  type FastifyInstance,
} from './core/http';

// Shared services
import { ConfigurationRepository } from './shared/repositories/configuration.repository';
import { UserMappingRepository } from './shared/repositories/user-mapping.repository';
import { VikunjaApiService } from './shared/services/vikunja-api.service';

// Features
import {
  SetupService,
  handleSetupDm,
  handleSetupDmSelect,
  setupCommandData,
  SETUP_COMMAND_NAME,
} from './features/setup';
import {
  ProjectsService,
  handleListProjects,
  handleAddProject,
  handleAddProjectSelect,
  handleAddChannelSelect,
  handleRemoveProject,
  handleRemoveChannelSelect,
  handleRemoveProjectSelect,
  projectsCommandData,
  PROJECTS_COMMAND_NAME,
  ADD_PROJECT_CUSTOM_IDS,
  REMOVE_PROJECT_CUSTOM_IDS,
} from './features/projects';
import {
  NotificationService,
  NotificationPayloadBuilder,
} from './features/notifications';
import {
  WebhookService,
  WebhookRegistrationService,
  createWebhookRoutes,
  createTestWebhookRoutes,
} from './features/webhook';
import type {
  VikunjaTask,
  VikunjaProject,
} from './shared/types/vikunja.types';

/**
 * Application container with all services
 */
export interface App {
  logger: ILogger;
  db: Database;
  discordClient: Client;
  httpServer: FastifyInstance;

  // Services
  configRepository: ConfigurationRepository;
  userMappingRepository: UserMappingRepository;
  vikunjaApiService: VikunjaApiService;
  setupService: SetupService;
  projectsService: ProjectsService;
  notificationService: NotificationService;
  webhookService: WebhookService;
  webhookRegistrationService: WebhookRegistrationService;
  payloadBuilder: NotificationPayloadBuilder;
}

/**
 * Creates the application container with all dependencies
 * This is the Composition Root - the single place where all dependencies are wired together
 */
export async function createApp(): Promise<App> {
  // Load and validate environment first
  loadEnv();

  // Get configs
  const vikunjaConfig = getVikunjaConfig();
  const dbConfig = getDatabaseConfig();

  // Create core dependencies
  const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    name: 'vikunja-discord-bot',
  });
  const { db } = createDatabase(dbConfig.url);

  // Create shared services
  const configRepository = new ConfigurationRepository({ logger, db });
  const userMappingRepository = new UserMappingRepository({ logger, db });
  const vikunjaApiService = new VikunjaApiService({
    logger,
    apiUrl: vikunjaConfig.apiUrl,
    apiToken: vikunjaConfig.apiToken,
  });

  // Create feature services
  const webhookRegistrationService = new WebhookRegistrationService({
    logger,
    vikunjaApiService,
    webhookCallbackUrl: vikunjaConfig.webhookCallbackUrl,
    webhookSecret: vikunjaConfig.webhookSecret,
  });

  const setupService = new SetupService({
    logger,
    configRepository,
    vikunjaApiService,
    webhookRegistrationService,
  });

  const projectsService = new ProjectsService({
    logger,
    configRepository,
    vikunjaApiService,
    webhookRegistrationService,
  });

  const notificationService = new NotificationService({ logger });

  const webhookService = new WebhookService({
    logger,
    webhookSecret: vikunjaConfig.webhookSecret,
  });

  const payloadBuilder = new NotificationPayloadBuilder({
    logger,
    userMappingRepository,
    frontendUrl: vikunjaConfig.frontendUrl,
    vikunjaApiService,
  });

  // Create Discord client
  const discordClient = createDiscordClient();

  // Register ready event
  registerReadyEvent(discordClient, { logger });

  // Register interaction handler
  registerInteractionHandler(discordClient, {
    logger,
    setupService,
    projectsService,
  });

  // Helper to extract projectId from event (for routing)
  const getProjectIdFromEvent = (event: {
    event_name: string;
    data: unknown;
  }): number | undefined => {
    const data = event.data as Record<string, unknown>;

    // Task events
    if (data.task) {
      return (data.task as VikunjaTask).project_id;
    }
    // Project events
    if (data.project) {
      return (data.project as VikunjaProject).id;
    }
    // Team events don't have projectId directly
    return undefined;
  };

  // Create route registers for HTTP server
  const webhookRouteRegister = createWebhookRoutes({
    logger,
    onWebhookReceived: async (rawPayload, signature) => {
      const event = await webhookService.processWebhook(rawPayload, signature);
      if (!event) return;

      const projectId = getProjectIdFromEvent(event);

      // Skip team events for now (they don't have a project context for routing)
      if (projectId === undefined) {
        logger.warn('Webhook event has no project ID, skipping notification', {
          event_name: event.event_name,
        });
        return;
      }

      // Build rich payload
      const payload = await payloadBuilder.buildPayload(
        event.event_name,
        event.time,
        event.data
      );

      if (!payload) {
        logger.warn('Failed to build notification payload', {
          event_name: event.event_name,
        });
        return;
      }

      // Find targets and send notifications
      const targets = await configRepository.findNotificationTargets(projectId);

      for (const target of targets) {
        if (target.type === 'dm') {
          await notificationService.sendToDm(
            discordClient,
            target.targetId,
            payload
          );
        } else {
          await notificationService.sendToChannel(
            discordClient,
            target.targetId,
            payload
          );
        }
      }
    },
  });

  // Create test webhook route register (only active in development)
  const testWebhookRouteRegister = createTestWebhookRoutes({
    logger,
    onTestEvent: async (event) => {
      const projectId = getProjectIdFromEvent(event);

      // Skip if we don't have a project ID
      if (projectId === undefined) {
        logger.warn(
          'Test webhook event has no project ID, skipping notification',
          {
            event_name: event.event_name,
          }
        );
        return;
      }

      // Build rich payload
      const payload = await payloadBuilder.buildPayload(
        event.event_name,
        event.time,
        event.data
      );

      if (!payload) {
        logger.warn('Failed to build test notification payload', {
          event_name: event.event_name,
        });
        return;
      }

      // Find targets and send notifications (bypasses signature validation)
      const targets = await configRepository.findNotificationTargets(projectId);

      for (const target of targets) {
        if (target.type === 'dm') {
          await notificationService.sendToDm(
            discordClient,
            target.targetId,
            payload
          );
        } else {
          await notificationService.sendToChannel(
            discordClient,
            target.targetId,
            payload
          );
        }
      }
    },
  });

  // Create HTTP server with route registers
  const httpServer = await createHttpServer({ logger }, [
    webhookRouteRegister,
    testWebhookRouteRegister,
  ]);

  logger.info('Application container created');

  return {
    logger,
    db,
    discordClient,
    httpServer,
    configRepository,
    userMappingRepository,
    vikunjaApiService,
    setupService,
    projectsService,
    notificationService,
    webhookService,
    webhookRegistrationService,
    payloadBuilder,
  };
}

/**
 * Get all command data for deployment
 */
export function getCommandsData() {
  return [setupCommandData, projectsCommandData];
}

// ============ Internal Helpers ============

interface InteractionHandlerDeps {
  logger: ILogger;
  setupService: SetupService;
  projectsService: ProjectsService;
}

function registerInteractionHandler(
  client: Client,
  deps: InteractionHandlerDeps
): void {
  const { logger, setupService, projectsService } = deps;

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;

        if (commandName === SETUP_COMMAND_NAME) {
          const subcommand = interaction.options.getSubcommand();

          if (subcommand === 'dm') {
            await handleSetupDm(interaction, { logger, setupService });
          }
        } else if (commandName === PROJECTS_COMMAND_NAME) {
          const subcommand = interaction.options.getSubcommand();

          if (subcommand === 'list') {
            await handleListProjects(interaction, { logger, projectsService });
          } else if (subcommand === 'add') {
            await handleAddProject(interaction, { logger, projectsService });
          } else if (subcommand === 'remove') {
            await handleRemoveProject(interaction, { logger, projectsService });
          }
        } else if (commandName === 'ping') {
          await interaction.reply({
            content: '🏓 Pong! Bot está funcionando.',
            ephemeral: true,
          });
        }
      } else if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        if (customId === 'setup_dm_project_select') {
          await handleSetupDmSelect(interaction, { logger, setupService });
        } else if (customId.startsWith(ADD_PROJECT_CUSTOM_IDS.PROJECT_SELECT)) {
          await handleAddProjectSelect(interaction, {
            logger,
            projectsService,
          });
        } else if (customId === REMOVE_PROJECT_CUSTOM_IDS.CHANNEL_SELECT) {
          await handleRemoveChannelSelect(interaction, {
            logger,
            projectsService,
          });
        } else if (customId === REMOVE_PROJECT_CUSTOM_IDS.PROJECT_SELECT) {
          await handleRemoveProjectSelect(interaction, {
            logger,
            projectsService,
          });
        }
      } else if (interaction.isChannelSelectMenu()) {
        const customId = interaction.customId;

        if (customId.startsWith(ADD_PROJECT_CUSTOM_IDS.CHANNEL_SELECT)) {
          await handleAddChannelSelect(interaction, {
            logger,
            projectsService,
          });
        }
      }
    } catch (error) {
      logger.error('Interaction failed', {
        type: interaction.type,
        id: interaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      const errorMessage = '❌ Ocorreu um erro ao processar sua solicitação.';

      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true,
          });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    }
  });

  logger.debug('Interaction handler registered');
}
