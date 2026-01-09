/**
 * Reminder Service
 *
 * Business logic for creating and managing reminders
 */

import type { ILogger } from '../../../shared/types';
import type { Client, TextChannel } from 'discord.js';
import type { SchedulerService } from '../../../core/scheduler';
import type {
  ReminderRepository,
  ReminderRecord,
  CreateReminderData,
} from '../repositories/reminder.repository';
import type { ConfigurationRepository } from '../../../shared/repositories/configuration.repository';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';
import type { UserMappingRepository } from '../../../shared/repositories/user-mapping.repository';
import { formatNotificationMessage } from '../../notifications/formatters/notification.formatter';
import type { NotificationPayload, UserReference } from '../../notifications/types';
import type { VikunjaProject } from '../../../shared/types/vikunja.types';

export interface ReminderServiceDeps {
  logger: ILogger;
  schedulerService: SchedulerService;
  reminderRepository: ReminderRepository;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
  userMappingRepository: UserMappingRepository;
  discordClient: Client;
}

export interface CreateReminderInput {
  discordUserId: string;
  vikunjaTaskId: number;
  vikunjaProjectId: number;
  targetType: 'dm' | 'guild';
  guildId?: string;
  cronExpression: string;
  startsAt?: Date;
  message?: string;
  mentionType?: 'assignees' | 'everyone';
}

export class ReminderService {
  private readonly logger: ILogger;
  private readonly scheduler: SchedulerService;
  private readonly reminderRepo: ReminderRepository;
  private readonly configRepo: ConfigurationRepository;
  private readonly vikunjaApi: VikunjaApiService;
  private readonly userMappingRepo: UserMappingRepository;
  private readonly discordClient: Client;

  constructor(deps: ReminderServiceDeps) {
    this.logger = deps.logger;
    this.scheduler = deps.schedulerService;
    this.reminderRepo = deps.reminderRepository;
    this.configRepo = deps.configRepository;
    this.vikunjaApi = deps.vikunjaApiService;
    this.userMappingRepo = deps.userMappingRepository;
    this.discordClient = deps.discordClient;
  }

  /**
   * Load and schedule all enabled reminders from database
   * Called on bot startup
   */
  async loadReminders(): Promise<void> {
    const reminders = await this.reminderRepo.findAllEnabled();
    this.logger.info('Loading reminders from database', { count: reminders.length });

    for (const reminder of reminders) {
      this.scheduleReminder(reminder);
    }
  }

  /**
   * Create a new reminder
   */
  async createReminder(input: CreateReminderInput): Promise<ReminderRecord> {
    // Calculate next run time
    // If startsAt is provided and in the future, use it directly as the first execution
    // Otherwise, calculate based on cron expression
    let nextRunAt: Date;
    
    if (input.startsAt && input.startsAt > new Date()) {
      // Use the provided startsAt as the first execution time
      nextRunAt = input.startsAt;
    } else {
      // Calculate next run from cron (for cases without startsAt or when startsAt is in the past)
      const calculatedNext = this.scheduler.getNextRun(input.cronExpression);
      if (!calculatedNext) {
        throw new Error('Invalid cron expression');
      }
      nextRunAt = calculatedNext;
    }

    const data: CreateReminderData = {
      discordUserId: input.discordUserId,
      vikunjaTaskId: input.vikunjaTaskId,
      vikunjaProjectId: input.vikunjaProjectId,
      targetType: input.targetType,
      guildId: input.guildId,
      cronExpression: input.cronExpression,
      startsAt: input.startsAt,
      nextRunAt,
      message: input.message,
      mentionType: input.mentionType || 'assignees',
    };

    const reminder = await this.reminderRepo.create(data);
    this.scheduleReminder(reminder);

    return reminder;
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(id: number, discordUserId: string): Promise<boolean> {
    const reminder = await this.reminderRepo.findById(id);

    if (!reminder || reminder.discordUserId !== discordUserId) {
      return false;
    }

    this.scheduler.cancel(`reminder_${id}`);
    return await this.reminderRepo.delete(id);
  }

  /**
   * Get reminders for a user
   */
  async getUserReminders(discordUserId: string): Promise<ReminderRecord[]> {
    return await this.reminderRepo.findByUserId(discordUserId);
  }

  /**
   * Schedule a reminder in the cron scheduler
   */
  private scheduleReminder(reminder: ReminderRecord): void {
    const jobId = `reminder_${reminder.id}`;

    this.scheduler.schedule(
      jobId,
      reminder.cronExpression,
      async () => await this.executeReminder(reminder),
      { startsAt: reminder.startsAt ?? undefined }
    );
  }

  /**
   * Execute a reminder - send notification
   */
  private async executeReminder(reminder: ReminderRecord): Promise<void> {
    this.logger.debug('Executing reminder', { id: reminder.id, taskId: reminder.vikunjaTaskId });

    try {
      // Fetch current task info
      const task = await this.vikunjaApi.getTaskById(reminder.vikunjaTaskId);

      if (!task) {
        this.logger.warn('Task not found for reminder, disabling', {
          reminderId: reminder.id,
          taskId: reminder.vikunjaTaskId,
        });
        await this.reminderRepo.disable(reminder.id);
        this.scheduler.cancel(`reminder_${reminder.id}`);
        return;
      }

      // Fetch project info for better display
      let project: VikunjaProject | undefined;
      try {
        const projectResult = await this.vikunjaApi.getProject(reminder.vikunjaProjectId);
        project = (projectResult as VikunjaProject) || undefined;
      } catch (e) {
        this.logger.warn('Failed to fetch project for reminder', { 
          projectId: reminder.vikunjaProjectId,
          error: e instanceof Error ? e.message : String(e)
        });
      }

      // Build task info for embed
      const taskInfo = {
        id: task.id ?? reminder.vikunjaTaskId,
        title: task.title ?? 'Task sem título',
        project_id: task.project_id ?? reminder.vikunjaProjectId,
        project_title: project?.title ?? 'Projeto',
        project_identifier: project?.identifier,
        due_date: task.due_date,
        description: task.description,
        assignees: task.assignees,
      };

      if (reminder.targetType === 'dm') {
        // Send to DM
        await this.sendDmReminder(reminder.discordUserId, taskInfo, reminder.message);
      } else {
        // Send to guild channel
        await this.sendGuildReminder(reminder, taskInfo, reminder.message);
      }

      // Update next run time
      // Check if it's a one-time reminder (has specific day and month)
      const cronParts = reminder.cronExpression.split(' ');
      const isOneTime = cronParts[2] !== '*' && cronParts[3] !== '*';

      if (isOneTime) {
        this.logger.debug('Deleting one-time reminder after execution', { id: reminder.id });
        await this.deleteReminder(reminder.id, reminder.discordUserId);
      } else {
        // Update next run time for recurring reminders
        const nextRun = this.scheduler.getNextRun(reminder.cronExpression);
        if (nextRun) {
          await this.reminderRepo.updateNextRunAt(reminder.id, nextRun);
        }
      }
    } catch (error) {
      this.logger.error('Failed to execute reminder', {
        reminderId: reminder.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendDmReminder(
    discordUserId: string,
    task: { 
      id: number; 
      title: string; 
      project_id: number; 
      project_title: string;
      project_identifier?: string;
      due_date?: string | null; 
      description?: string | null;
      assignees?: any[];
    },
    customMessage?: string | null
  ): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(discordUserId);
      const reminder: ReminderRecord = {
        message: customMessage || null,
        mentionType: 'assignees',
      } as any; // Mock reminder record for DM
      
      const payload = await this.createNotificationPayload(task, reminder, 'dm');
      const { embeds } = formatNotificationMessage(payload);

      await user.send({ embeds });
      this.logger.debug('DM reminder sent', { userId: discordUserId, taskTitle: task.title });
    } catch (error) {
      this.logger.warn('Failed to send DM reminder', {
        userId: discordUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendGuildReminder(
    reminder: ReminderRecord,
    task: { 
      id: number; 
      title: string; 
      project_id: number; 
      project_title: string;
      project_identifier?: string;
      due_date?: string | null; 
      description?: string | null;
      assignees?: any[];
    },
    customMessage?: string | null
  ): Promise<void> {
    if (!reminder.guildId) {
      this.logger.warn('Guild reminder missing guildId', { reminderId: reminder.id });
      return;
    }

    // Find channel for this project in guild
    const bindings = await this.configRepo.listGuildChannels(reminder.guildId);
    const binding = bindings?.find((b) => b.projectId === reminder.vikunjaProjectId);

    if (!binding) {
      this.logger.warn('No channel binding found for project', {
        reminderId: reminder.id,
        projectId: reminder.vikunjaProjectId,
        guildId: reminder.guildId,
      });
      return;
    }

    try {
      const channel = await this.discordClient.channels.fetch(binding.channelId);
      if (channel?.isTextBased()) {
        const payload = await this.createNotificationPayload(task, reminder, 'guild');
        const { embeds } = formatNotificationMessage(payload);

        let content = '';
        if (reminder.mentionType === 'everyone') {
          content = '@everyone';
        }

        await (channel as TextChannel).send({
          content: content || undefined,
          embeds,
        });

        this.logger.debug('Guild reminder sent', {
          channelId: binding.channelId,
          taskTitle: task.title,
          mentionType: reminder.mentionType,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to send guild reminder', {
        channelId: binding.channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async createNotificationPayload(
    task: { 
      id: number; 
      title: string; 
      project_id: number; 
      project_title: string;
      project_identifier?: string;
      due_date?: string | null; 
      description?: string | null;
      assignees?: any[]; 
    },
    reminder: ReminderRecord,
    targetType: 'dm' | 'guild'
  ): Promise<NotificationPayload> {
    // Create a mock user for the author (Display Bot Name or "System")
    const author: UserReference = {
      vikunjaId: 0,
      username: 'Lembrete',
      name: 'Lembrete',
    };

    // Resolve assignees with Discord IDs
    const assignees: UserReference[] = [];
    
    if (task.assignees && task.assignees.length > 0) {
      for (const u of task.assignees) {
        const discordUserId = await this.userMappingRepo.findDiscordUserId(u.id);
        assignees.push({
          vikunjaId: u.id,
          username: u.username,
          name: u.name,
          discordUserId: discordUserId || undefined, // Include Discord ID if available
          avatarUrl: u.avatar_url,
        });
      }
    }

    const frontendUrl = process.env.VIKUNJA_FRONTEND_URL || 'https://vikunja.io';

    return {
      eventType: 'task.reminder', // Use new specific event type for correct emoji/label
      title: `Lembrete: ${task.title}`,
      description: reminder.message || undefined,
      timestamp: new Date(),
      // Color is handled by formatter based on event type, but can override if needed
      url: `${frontendUrl}/tasks/${task.id}`,
      author,
      project: {
        id: task.project_id,
        title: task.project_title,
        identifier: task.project_identifier || 'PROJ',
        url: `${frontendUrl}/projects/${task.project_id}`,
      },
      context: {
        type: 'task',
        data: {
          taskId: task.id,
          taskIdentifier: `#${task.id}`,
          projectId: task.project_id,
          dueDate: task.due_date ? new Date(task.due_date) : undefined,
          assignees: assignees,
        },
      },
    };
  }
}

export function createReminderService(deps: ReminderServiceDeps): ReminderService {
  return new ReminderService(deps);
}
