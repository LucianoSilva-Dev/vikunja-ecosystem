import { EmbedBuilder } from 'discord.js';
import type { VikunjaEventType } from '../../../shared/types';
import type { NotificationPayload } from '../types';

/**
 * Color codes for different event types
 */
const EVENT_COLORS: { [K in VikunjaEventType]: number } = {
  'task.created': 0x22c55e, // Green
  'task.updated': 0x3b82f6, // Blue
  'task.deleted': 0xef4444, // Red
  'task.assignee.created': 0x8b5cf6, // Purple
  "task.assignee.deleted": 0xef4444, // Red
  'task.comment.created': 0xf59e0b, // Amber
  'task.comment.deleted': 0xef4444, // Red
  'task.comment.edited': 0xf59e0b, // Amber
  "task.attachment.created": 0x3b82f6, // Blue
  "task.attachment.deleted": 0xef4444, // Red,
  "task.relation.created": 0x3b82f6, // Blue,
  "task.relation.deleted": 0xef4444, // Red,
  'project.created': 0x10b981, // Emerald
  'project.updated': 0x6366f1, // Indigo
  'project.deleted': 0xdc2626, // Red
  'team.member.added': 0x10b981, // Emerald
  'team.member.removed': 0xdc2626, // Red
  'team.created': 0x6366f1, // Indigo
  'team.deleted': 0xdc2626, // Red
  "project.shared.team": 0x6366f1, // Indigo
  "project.shared.user": 0x6366f1, // Indigo
};

/**
 * Emoji prefixes for different event types
 */
const EVENT_EMOJIS: { [K in VikunjaEventType]: string } = {
  'task.created': '✅',
  'task.updated': '📝',
  'task.deleted': '🗑️',
  'task.assignee.created': '👤',
  'task.assignee.deleted': '🚫',
  'task.comment.created': '💬',
  'task.comment.edited': '✏️',
  'task.comment.deleted': '❌',
  'task.attachment.created': '📎',
  'task.attachment.deleted': '🗑️',
  'task.relation.created': '🔗',
  'task.relation.deleted': '💔',
  'project.created': '📁',
  'project.updated': '📂',
  'project.deleted': '🗑️',
  'project.shared.team': '👥',
  'project.shared.user': '👤',
  'team.created': '🛡️',
  'team.deleted': '🗑️',
  'team.member.added': '👋',
  'team.member.removed': '🚪',
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
    const authorData: { name: string; iconURL?: string } = {
      name: payload.author.name,
    };
    
    if (payload.author.avatarUrl) {
      authorData.iconURL = payload.author.avatarUrl;
    }

    embed.setAuthor(authorData);
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
