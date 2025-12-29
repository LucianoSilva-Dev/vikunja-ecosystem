import { EmbedBuilder } from 'discord.js';
import type { VikunjaEventType } from '../../../shared/types';
import type { NotificationPayload } from './notification.types';

/**
 * Color codes for different event types
 */
const EVENT_COLORS: Record<VikunjaEventType, number> = {
  'task.created': 0x22c55e, // Green
  'task.updated': 0x3b82f6, // Blue
  'task.deleted': 0xef4444, // Red
  'task.assignee.created': 0x8b5cf6, // Purple
  'task.comment.created': 0xf59e0b, // Amber
  'project.created': 0x10b981, // Emerald
  'project.updated': 0x6366f1, // Indigo
  'project.deleted': 0xdc2626, // Red
};

/**
 * Emoji prefixes for different event types
 */
const EVENT_EMOJIS: Record<VikunjaEventType, string> = {
  'task.created': '✅',
  'task.updated': '📝',
  'task.deleted': '🗑️',
  'task.assignee.created': '👤',
  'task.comment.created': '💬',
  'project.created': '📁',
  'project.updated': '📂',
  'project.deleted': '🗑️',
};

/**
 * Formats a notification payload into a Discord message
 */
export function formatNotificationMessage(
  payload: NotificationPayload
): { embeds: EmbedBuilder[] } {
  const emoji = EVENT_EMOJIS[payload.eventType] || '📌';
  const color = payload.color || EVENT_COLORS[payload.eventType] || 0x5865f2;

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${payload.title}`)
    .setColor(color)
    .setTimestamp(payload.timestamp || new Date());

  if (payload.description) {
    embed.setDescription(payload.description);
  }

  if (payload.url) {
    embed.setURL(payload.url);
  }

  if (payload.author) {
    embed.setAuthor({
      name: payload.author.name,
      iconURL: payload.author.avatarUrl,
    });
  }

  if (payload.fields && payload.fields.length > 0) {
    embed.addFields(
      payload.fields.map((field) => ({
        name: field.name,
        value: field.value,
        inline: field.inline ?? false,
      }))
    );
  }

  return { embeds: [embed] };
}
