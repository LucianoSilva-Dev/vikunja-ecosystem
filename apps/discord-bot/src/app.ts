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
import {
  AuthService,
  AuthCommand,
  AuthInteractionHandler,
  CONNECT_ACCOUNT_COMMAND_NAME,
  DISCONNECT_ACCOUNT_COMMAND_NAME,
} from './features/auth';
import {
  createTaskActionService,
  createTaskActionButtonHandler,
  createTaskActionModalHandler,
  type TaskActionButtonHandler,
  type TaskActionModalHandler,
  // Command and handlers
  TASK_COMMAND_NAME,
  taskCommandData,
  handleTaskCommand,
  handleTaskProjectSelect,
  handleTaskTaskSelect,
  handleTaskActionSelect,
  handleDeleteRemindersSubmit,
  TASK_COMMAND_CUSTOM_IDS,
  canHandleReminderModal,
  handleReminderModalSubmit,
  // Reminder
  ReminderRepository,
  createReminderService,
  type ReminderService,
} from './features/task-actions';
import { createSchedulerService, type SchedulerService } from './core/scheduler';
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
  authService: AuthService;
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

  const authService = new AuthService({
    logger,
    userMappingRepository,
    vikunjaApiService,
  });

  const authCommand = new AuthCommand(logger, authService);
  const authInteractionHandler = new AuthInteractionHandler(logger, authService);

  // Scheduler and reminder services
  const schedulerService = createSchedulerService({ logger });
  const reminderRepository = new ReminderRepository({ logger, db });

  // Task actions handlers
  const taskActionService = createTaskActionService({
    logger,
    vikunjaApi: vikunjaApiService,
  });
  const taskActionButtonHandler = createTaskActionButtonHandler({
    logger,
    taskActionService,
    userMappingRepository,
  });
  const taskActionModalHandler = createTaskActionModalHandler({
    logger,
    taskActionService,
  });

  // Create Discord client
  const discordClient = createDiscordClient();

  // Reminder service needs discordClient
  const reminderService = createReminderService({
    logger,
    schedulerService,
    reminderRepository,
    configRepository,
    vikunjaApiService,
    discordClient,
  });

  // Register ready event and load reminders
  registerReadyEvent(discordClient, { logger });
  discordClient.once('ready', async () => {
    await reminderService.loadReminders();
  });

  // Register interaction handler
  registerInteractionHandler(discordClient, {
    logger,
    setupService,
    projectsService,
    configRepository,
    vikunjaApiService,
    userMappingRepository,
    authCommand,
    authInteractionHandler,
    taskActionButtonHandler,
    taskActionModalHandler,
    taskActionService,
    reminderService,
    reminderRepository,
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
    authService,
  };
}

/**
 * Get all command data for deployment
 */
export function getCommandsData() {
  const logger = createLogger({ name: 'temp-command-loader', level: 'info' }); // Temporary logger just for definition
  // Mock AuthService for command definition extraction
  const authCommand = new AuthCommand(logger, {} as AuthService);
  return [setupCommandData, projectsCommandData, taskCommandData, ...authCommand.definitions];
}

// ============ Internal Helpers ============

interface InteractionHandlerDeps {
  logger: ILogger;
  setupService: SetupService;
  projectsService: ProjectsService;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
  userMappingRepository: UserMappingRepository;
  authCommand: AuthCommand;
  authInteractionHandler: AuthInteractionHandler;
  taskActionButtonHandler: TaskActionButtonHandler;
  taskActionModalHandler: TaskActionModalHandler;
  taskActionService: ReturnType<typeof createTaskActionService>;
  reminderService: ReminderService;
  reminderRepository: ReminderRepository;
}

function registerInteractionHandler(
  client: Client,
  deps: InteractionHandlerDeps
): void {
  const {
    logger,
    setupService,
    projectsService,
    configRepository,
    vikunjaApiService,
    userMappingRepository,
    authCommand,
    authInteractionHandler,
    taskActionButtonHandler,
    taskActionModalHandler,
    taskActionService,
    reminderService,
    reminderRepository,
  } = deps;

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
        } else if (
          commandName === CONNECT_ACCOUNT_COMMAND_NAME ||
          commandName === DISCONNECT_ACCOUNT_COMMAND_NAME
        ) {
          await authCommand.handle(interaction);
        } else if (commandName === TASK_COMMAND_NAME) {
          await handleTaskCommand(interaction, {
            logger,
            configRepository,
            vikunjaApiService,
            reminderRepository,
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
        } else if (customId === TASK_COMMAND_CUSTOM_IDS.PROJECT_SELECT) {
          await handleTaskProjectSelect(interaction, {
            logger,
            configRepository,
            vikunjaApiService,
            reminderRepository,
          });
        } else if (customId.startsWith(TASK_COMMAND_CUSTOM_IDS.TASK_SELECT)) {
          await handleTaskTaskSelect(interaction, {
            logger,
            configRepository,
            vikunjaApiService,
            reminderRepository,
          });
        } else if (customId.startsWith(TASK_COMMAND_CUSTOM_IDS.ACTION_SELECT)) {
          await handleTaskActionSelect(interaction, {
            logger,
            taskActionService,
            userMappingRepository,
            reminderRepository,
          });
        } else if (customId.startsWith('task_reminder_delete')) {
          await handleDeleteRemindersSubmit(interaction, {
            logger,
            taskActionService,
            userMappingRepository,
            reminderRepository,
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
      } else if (interaction.isModalSubmit()) {
        // Check if it's a reminder modal
        if (canHandleReminderModal(interaction.customId)) {
          await handleReminderModalSubmit(interaction, {
            logger,
            reminderService,
          });
        } else if (taskActionModalHandler.canHandle(interaction.customId)) {
          // Check if it's a task action modal (due date)
          await taskActionModalHandler.handle(interaction);
        } else {
          await authInteractionHandler.handleModalSubmit(interaction);
        }
      } else if (interaction.isButton()) {
        // Handle task action buttons
        if (taskActionButtonHandler.canHandle(interaction.customId)) {
          await taskActionButtonHandler.handle(interaction);
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
