import type { Client, TextChannel } from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { NotificationPayload } from '../types';
import { formatNotificationMessage } from '../formatters/notification.formatter';

export interface NotificationServiceDeps {
  logger: ILogger;
}

/**
 * Service for sending notifications to Discord channels
 */
export class NotificationService {
  private readonly logger: ILogger;

  constructor(deps: NotificationServiceDeps) {
    this.logger = deps.logger;
  }

  /**
   * Sends a notification to a Discord channel
   */
  async sendToChannel(
    client: Client,
    channelId: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      const channel = await client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        this.logger.error('Invalid channel for notification', { channelId });
        return false;
      }

      const message = formatNotificationMessage(payload);
      await (channel as TextChannel).send(message);

      this.logger.info('Notification sent to channel', {
        channelId,
        eventType: payload.eventType,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to send notification to channel', {
        channelId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Sends a notification to a user's DM
   */
  async sendToDm(
    client: Client,
    userId: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      const user = await client.users.fetch(userId);
      const message = formatNotificationMessage(payload);
      await user.send(message);

      this.logger.info('Notification sent to DM', {
        userId,
        eventType: payload.eventType,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to send notification to DM', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

export function createNotificationService(
  deps: NotificationServiceDeps
): NotificationService {
  return new NotificationService(deps);
}
