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
  ProjectsService,
  handleListProjects,
  handleAddProject,
  handleAddProjectSelect,
  handleAddChannelSelect,
  handleAddEventButton,
  handleAddEventSelectAll,
  handleAddEventConfirm,
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
  // Reminder type select
  canHandleReminderTypeSelect,
  handleReminderTypeSelect,
  // Reminder mention select
  canHandleReminderMentionSelect,
  handleReminderMentionSelect,
  // Reminder
  ReminderRepository,
  createReminderService,
  type ReminderService,
} from './features/task-actions';

import {
  // Digest
  DigestRepository,
  DigestService,
  createDigestService,
  createDigestRepository,
  DIGEST_COMMAND_NAME,
  digestCommandData,
  DIGEST_CUSTOM_IDS,
  handleDigestAdd,
  handleDigestList,
  handleDigestRemove,
  handleDigestProjectSelect,
  handleDigestChannelSelect,
  handleDigestRemoveInteraction,
  DIGEST_REMOVE_IDS,
  // New Digest Handlers
  canHandleDigestTypeSelect,
  handleDigestTypeSelect,
  canHandleDigestModal,
  handleDigestModalSubmit,
  canHandleDigestPrioritySelect,
  handleDigestPrioritySelect,
} from './features/digest';
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

  projectsService: ProjectsService;
  notificationService: NotificationService;
  webhookService: WebhookService;
  webhookRegistrationService: WebhookRegistrationService;
  payloadBuilder: NotificationPayloadBuilder;
  authService: AuthService;
  reminderService: ReminderService;
  digestService: DigestService;
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
  const digestRepository = new DigestRepository({ logger, db });

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
    userMappingRepository,
    discordClient,
  });

  const digestService = createDigestService({
    logger,
    schedulerService,
    digestRepository,
    configRepository,
    vikunjaApiService,
    userMappingRepository,
    discordClient,
  });

  // Register ready event and load reminders
  registerReadyEvent(discordClient, { logger });
  discordClient.once('ready', async () => {
    await reminderService.loadReminders();
    await digestService.loadDigests();
  });

  // Register interaction handler
  registerInteractionHandler(discordClient, {
    logger,

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
    digestService,
    digestRepository,
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
        // Filter events based on user configuration
        // If the user has subscribed to specific events, only send notifications for those
        const allowedEvents = target.webhookEvents || [];
        if (!allowedEvents.includes(event.event_name)) {
             continue;
        }

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

    projectsService,
    notificationService,
    webhookService,
    webhookRegistrationService,
    payloadBuilder,
    authService,
    reminderService,
    digestService,
  };
}

/**
 * Get all command data for deployment
 */
export function getCommandsData() {
  const logger = createLogger({ name: 'temp-command-loader', level: 'info' }); // Temporary logger just for definition
  // Mock AuthService for command definition extraction
  const authCommand = new AuthCommand(logger, {} as AuthService);
  return [projectsCommandData, taskCommandData, digestCommandData, ...authCommand.definitions];
}

// ============ Internal Helpers ============


interface InteractionHandlerDeps {
  logger: ILogger;

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
  digestService: DigestService;
  digestRepository: DigestRepository;
}

function registerInteractionHandler(
  client: Client,
  deps: InteractionHandlerDeps
): void {
  const {
    logger,

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
    digestService,
    digestRepository,
  } = deps;

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;

        if (commandName === PROJECTS_COMMAND_NAME) {
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
        } else if (commandName === DIGEST_COMMAND_NAME) {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'add') {
             await handleDigestAdd(interaction, { logger, userMappingRepository, vikunjaApiService });
          } else if (subcommand === 'list') {
             await handleDigestList(interaction, { logger, digestService, vikunjaApiService });
          } else if (subcommand === 'remove') {
             await handleDigestRemove(interaction, { logger, digestService, vikunjaApiService });
          }
        }
      } else if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        if (customId === DIGEST_CUSTOM_IDS.PROJECT_SELECT) {
            await handleDigestProjectSelect(interaction, { logger, userMappingRepository, vikunjaApiService });
        } else if (canHandleDigestTypeSelect(customId)) {
            await handleDigestTypeSelect(interaction, { logger });
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
        } else if (canHandleReminderTypeSelect(customId)) {
          // Handle reminder type selection (first step of two-step flow)
          await handleReminderTypeSelect(interaction, { logger });
        } else if (canHandleReminderMentionSelect(customId)) {
          // Handle reminder mention selection (intermediate step)
          await handleReminderMentionSelect(interaction, { logger });
        } else if (canHandleDigestPrioritySelect(customId)) {
          await handleDigestPrioritySelect(interaction, { logger });
        }
      } else if (interaction.isChannelSelectMenu()) {
        const customId = interaction.customId;

        if (customId.startsWith(ADD_PROJECT_CUSTOM_IDS.CHANNEL_SELECT)) {
          await handleAddChannelSelect(interaction, {
            logger,
            projectsService,
          });
        } else if (customId.startsWith('digest_channel_select')) {
            await handleDigestChannelSelect(interaction, { logger, userMappingRepository, vikunjaApiService });
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
        } else if (interaction.customId.startsWith('digest_create_modal')) {
             // Basic redirect for legacy/fallback if needed, but we use canHandleDigestModal
             if (canHandleDigestModal(interaction.customId)) {
                await handleDigestModalSubmit(interaction, { logger, digestService });
             }
        } else if (canHandleDigestModal(interaction.customId)) {
             await handleDigestModalSubmit(interaction, { logger, digestService });
        } else {
          await authInteractionHandler.handleModalSubmit(interaction);
        }
      } else if (interaction.isButton()) {
        const customId = interaction.customId;
        
        // Handle task action buttons
        if (taskActionButtonHandler.canHandle(customId)) {
          await taskActionButtonHandler.handle(interaction);
        } else if (customId.startsWith(ADD_PROJECT_CUSTOM_IDS.EVENT_BTN_PREFIX)) {
            await handleAddEventButton(interaction, {
                logger,
                projectsService,
            });
        } else if (customId.startsWith(ADD_PROJECT_CUSTOM_IDS.EVENT_ALL)) {
            await handleAddEventSelectAll(interaction, {
                logger,
                projectsService,
            });
        } else if (customId.startsWith(ADD_PROJECT_CUSTOM_IDS.EVENT_CONFIRM)) {
            await handleAddEventConfirm(interaction, {
                logger,
                projectsService,
            });
        } else if (
            customId.startsWith(DIGEST_REMOVE_IDS.TOGGLE_PREFIX) || 
            customId === DIGEST_REMOVE_IDS.CONFIRM || 
            customId === DIGEST_REMOVE_IDS.CANCEL
        ) {
            await handleDigestRemoveInteraction(interaction, { logger, digestService, vikunjaApiService });
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
