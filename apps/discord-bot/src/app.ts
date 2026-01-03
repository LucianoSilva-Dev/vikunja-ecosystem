import {
  loadEnv,
  getVikunjaConfig,
  getDatabaseConfig,
} from './shared/config';
import type { ILogger } from './shared/types';

// Core modules
import { createLogger } from './core/logger';
import { createDatabase, type Database } from './core/database';
import { createDiscordClient, registerReadyEvent, type Client } from './core/discord';
import { createHttpServer, type FastifyInstance, type RouteRegister } from './core/http';

// Shared services
import { ConfigurationRepository } from './shared/repositories/configuration.repository';
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
import { NotificationService } from './features/notifications';
import { WebhookService, WebhookRegistrationService, createWebhookRoutes, createTestWebhookRoutes } from './features/webhook';
import { VikunjaTask, VikunjaProject, VikunjaUser } from './shared/types/vikunja.types';

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
  vikunjaApiService: VikunjaApiService;
  setupService: SetupService;
  projectsService: ProjectsService;
  notificationService: NotificationService;
  webhookService: WebhookService;
  webhookRegistrationService: WebhookRegistrationService;
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

  // Helper to extract common data from event
  const extractEventData = (event: any) => {
    let projectId: number | undefined;
    let title = 'Untitled';
    let description: string | undefined;
    let author: { name: string; avatarUrl?: string } | undefined;

    // Check for Task data (all task events have 'task' field)
    if (event.data && typeof event.data === 'object' && 'task' in event.data) {
      const task = event.data.task as VikunjaTask;
      const doer = event.data.doer as VikunjaUser | undefined;
      
      projectId = task.project_id;
      title = task.title;
      description = task.description;
      if (doer) {
        author = {
          name: doer.name || doer.username,
          avatarUrl: doer.avatar_url,
        };
      }
    } 
    // Check for Project data
    else if (event.data && typeof event.data === 'object' && 'project' in event.data) {
      const project = event.data.project as VikunjaProject;
      const doer = event.data.doer as VikunjaUser | undefined;

      projectId = project.id;
      title = project.title;
      description = project.description;
      if (doer) {
        author = {
          name: doer.name || doer.username,
          avatarUrl: doer.avatar_url,
        };
      }
    }

    return { projectId, title, description, author };
  };

  // Create route registers for HTTP server
  const webhookRouteRegister = createWebhookRoutes({
    logger,
    onWebhookReceived: async (rawPayload, signature) => {
      const event = await webhookService.processWebhook(rawPayload, signature);
      if (event) {
        const { projectId, title, description, author } = extractEventData(event);
        
        // Skip if we don't have a project ID (e.g., for deleted tasks without project info, should not happen with new structs usually)
        if (projectId === undefined) {
          logger.warn('Webhook event has no project ID, skipping notification', {
            event_name: event.event_name,
          });
          return;
        }

        // Find targets and send notifications
        const targets = await configRepository.findNotificationTargets(projectId);

        for (const target of targets) {
          const payload = {
            eventType: event.event_name,
            title: title,
            description: description,
            timestamp: new Date(event.time),
            author,
          };

          if (target.type === 'dm') {
            await notificationService.sendToDm(discordClient, target.targetId, payload);
          } else {
            await notificationService.sendToChannel(discordClient, target.targetId, payload);
          }
        }
      }
    },
  });

  // Create test webhook route register (only active in development)
  const testWebhookRouteRegister = createTestWebhookRoutes({
    logger,
    onTestEvent: async (event) => {
      const { projectId, title, description, author } = extractEventData(event);
      
      // Skip if we don't have a project ID
      if (projectId === undefined) {
        logger.warn('Test webhook event has no project ID, skipping notification', {
          event_name: event.event_name,
        });
        return;
      }

      // Find targets and send notifications (bypasses signature validation)
      const targets = await configRepository.findNotificationTargets(projectId);

      for (const target of targets) {
        const payload = {
          eventType: event.event_name,
          title: title,
          description: description,
          timestamp: new Date(event.time),
          author,
        };

        if (target.type === 'dm') {
          await notificationService.sendToDm(discordClient, target.targetId, payload);
        } else {
          await notificationService.sendToChannel(discordClient, target.targetId, payload);
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
    vikunjaApiService,
    setupService,
    projectsService,
    notificationService,
    webhookService,
    webhookRegistrationService,
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
          await handleAddProjectSelect(interaction, { logger, projectsService });
        } else if (customId === REMOVE_PROJECT_CUSTOM_IDS.CHANNEL_SELECT) {
          await handleRemoveChannelSelect(interaction, { logger, projectsService });
        } else if (customId === REMOVE_PROJECT_CUSTOM_IDS.PROJECT_SELECT) {
          await handleRemoveProjectSelect(interaction, { logger, projectsService });
        }
      } else if (interaction.isChannelSelectMenu()) {
        const customId = interaction.customId;

        if (customId.startsWith(ADD_PROJECT_CUSTOM_IDS.CHANNEL_SELECT)) {
          await handleAddChannelSelect(interaction, { logger, projectsService });
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
