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

export interface ReminderServiceDeps {
  logger: ILogger;
  schedulerService: SchedulerService;
  reminderRepository: ReminderRepository;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
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
}

export class ReminderService {
  private readonly logger: ILogger;
  private readonly scheduler: SchedulerService;
  private readonly reminderRepo: ReminderRepository;
  private readonly configRepo: ConfigurationRepository;
  private readonly vikunjaApi: VikunjaApiService;
  private readonly discordClient: Client;

  constructor(deps: ReminderServiceDeps) {
    this.logger = deps.logger;
    this.scheduler = deps.schedulerService;
    this.reminderRepo = deps.reminderRepository;
    this.configRepo = deps.configRepository;
    this.vikunjaApi = deps.vikunjaApiService;
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
    const nextRunAt = this.scheduler.getNextRun(input.cronExpression, input.startsAt);
    if (!nextRunAt) {
      throw new Error('Invalid cron expression');
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

      // Build task info for embed
      const taskInfo = {
        id: task.id ?? reminder.vikunjaTaskId,
        title: task.title ?? 'Task sem título',
        project_id: task.project_id ?? reminder.vikunjaProjectId,
        due_date: task.due_date,
        description: task.description,
      };

      if (reminder.targetType === 'dm') {
        // Send to DM
        await this.sendDmReminder(reminder.discordUserId, taskInfo, reminder.message);
      } else {
        // Send to guild channel
        await this.sendGuildReminder(reminder, taskInfo, reminder.message);
      }

      // Update next run time
      const nextRun = this.scheduler.getNextRun(reminder.cronExpression);
      if (nextRun) {
        await this.reminderRepo.updateNextRunAt(reminder.id, nextRun);
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
    task: { id: number; title: string; project_id: number; due_date?: string | null; description?: string | null },
    customMessage?: string | null
  ): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(discordUserId);
      
      // Build reminder embed
      const { EmbedBuilder } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(`🔔 ${task.title}`)
        .setURL(`${process.env.VIKUNJA_FRONTEND_URL || 'https://vikunja.io'}/tasks/${task.id}`)
        .setColor(0xf39c12)
        .setTimestamp();

      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        if (dueDate.getFullYear() > 1) {
          embed.addFields({
            name: '📅 Prazo',
            value: dueDate.toLocaleDateString('pt-BR'),
            inline: true,
          });
        }
      }

      if (customMessage) {
        embed.setDescription(customMessage);
      }

      await user.send({ embeds: [embed] });
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
    task: { id: number; title: string; project_id: number; due_date?: string | null; description?: string | null },
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
        // Build reminder embed
        const { EmbedBuilder } = await import('discord.js');
        const embed = new EmbedBuilder()
          .setTitle(`🔔 ${task.title}`)
          .setURL(`${process.env.VIKUNJA_FRONTEND_URL || 'https://vikunja.io'}/tasks/${task.id}`)
          .setColor(0xf39c12)
          .setTimestamp();

        if (task.due_date) {
          const dueDate = new Date(task.due_date);
          if (dueDate.getFullYear() > 1) {
            embed.addFields({
              name: '📅 Prazo',
              value: dueDate.toLocaleDateString('pt-BR'),
              inline: true,
            });
          }
        }

        if (customMessage) {
          embed.setDescription(customMessage);
        }

        await (channel as TextChannel).send({ embeds: [embed] });
        this.logger.debug('Guild reminder sent', {
          channelId: binding.channelId,
          taskTitle: task.title,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to send guild reminder', {
        channelId: binding.channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function createReminderService(deps: ReminderServiceDeps): ReminderService {
  return new ReminderService(deps);
}
