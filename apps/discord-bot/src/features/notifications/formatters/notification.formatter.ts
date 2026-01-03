import { EmbedBuilder } from 'discord.js';
import type { VikunjaEventType } from '../../../shared/types';
import type { NotificationPayload, TaskEventContext } from '../types';
import {
  formatUserReference,
  formatAssignees,
  formatPriority,
  formatLabels,
  formatDate,
  formatProgress,
  formatRelationType,
  getEventTypeLabel,
} from './event-formatters';

/**
 * Color codes for different event types
 */
const EVENT_COLORS: { [K in VikunjaEventType]: number } = {
  'task.created': 0x22c55e, // Green
  'task.updated': 0x3b82f6, // Blue
  'task.deleted': 0xef4444, // Red
  'task.assignee.created': 0x8b5cf6, // Purple
  'task.assignee.deleted': 0xef4444, // Red
  'task.comment.created': 0xf59e0b, // Amber
  'task.comment.deleted': 0xef4444, // Red
  'task.comment.edited': 0xf59e0b, // Amber
  'task.attachment.created': 0x3b82f6, // Blue
  'task.attachment.deleted': 0xef4444, // Red,
  'task.relation.created': 0x3b82f6, // Blue,
  'task.relation.deleted': 0xef4444, // Red,
  'project.created': 0x10b981, // Emerald
  'project.updated': 0x6366f1, // Indigo
  'project.deleted': 0xdc2626, // Red
  'team.member.added': 0x10b981, // Emerald
  'team.member.removed': 0xdc2626, // Red
  'team.created': 0x6366f1, // Indigo
  'team.deleted': 0xdc2626, // Red
  'project.shared.team': 0x6366f1, // Indigo
  'project.shared.user': 0x6366f1, // Indigo
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
 * Adiciona campos específicos de contexto de tarefa ao embed
 */
function addTaskContextFields(
  embed: EmbedBuilder,
  context: TaskEventContext
): void {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  // Identificador da tarefa
  fields.push({
    name: '🔖 Identificador',
    value: context.taskIdentifier,
    inline: true,
  });

  // Status
  if (context.done !== undefined) {
    fields.push({
      name: '📋 Status',
      value: context.done ? '✅ Concluída' : '⏳ Pendente',
      inline: true,
    });
  }

  // Prioridade (apenas se definida e maior que 0)
  if (context.priority !== undefined && context.priority > 0) {
    fields.push({
      name: '🎯 Prioridade',
      value: formatPriority(context.priority),
      inline: true,
    });
  }

  // Data de vencimento
  if (context.dueDate) {
    fields.push({
      name: '📅 Vencimento',
      value: formatDate(context.dueDate),
      inline: true,
    });
  }

  // Datas de início e fim
  if (context.startDate) {
    fields.push({
      name: '🚀 Início',
      value: formatDate(context.startDate),
      inline: true,
    });
  }

  if (context.endDate) {
    fields.push({
      name: '🏁 Fim',
      value: formatDate(context.endDate),
      inline: true,
    });
  }

  // Progresso (apenas se maior que 0)
  if (context.percentDone !== undefined && context.percentDone > 0) {
    fields.push({
      name: '📊 Progresso',
      value: formatProgress(context.percentDone),
      inline: true,
    });
  }

  // Assignees
  if (context.assignees && context.assignees.length > 0) {
    fields.push({
      name: '👥 Responsáveis',
      value: formatAssignees(context.assignees),
      inline: false,
    });
  }

  // Labels
  if (context.labels && context.labels.length > 0) {
    fields.push({
      name: '🏷️ Labels',
      value: formatLabels(context.labels),
      inline: false,
    });
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }
}

/**
 * Formats a notification payload into a Discord message with rich embeds
 */
export function formatNotificationMessage(payload: NotificationPayload): {
  embeds: EmbedBuilder[];
} {
  const emoji = EVENT_EMOJIS[payload.eventType] || '📌';
  const color = payload.color || EVENT_COLORS[payload.eventType] || 0x5865f2;
  const eventLabel = getEventTypeLabel(payload.eventType);

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${payload.title}`)
    .setColor(color)
    .setTimestamp(payload.timestamp || new Date());

  // URL para o frontend
  if (payload.url) {
    embed.setURL(payload.url);
  }

  // Descrição com tipo de evento em linguagem natural
  const descriptionParts: string[] = [];
  descriptionParts.push(`**${eventLabel}**`);
  if (payload.description) {
    descriptionParts.push(payload.description);
  }
  embed.setDescription(descriptionParts.join('\n\n'));

  // Autor da ação
  if (payload.author) {
    const authorDisplay = formatUserReference(payload.author);
    const authorName = payload.author.name || payload.author.username;

    embed.setAuthor({
      name: authorName,
      ...(payload.author.avatarUrl && { iconURL: payload.author.avatarUrl }),
    });

    // Se temos uma menção Discord, adicionar como campo
    if (payload.author.discordUserId) {
      embed.addFields({
        name: '👤 Autor',
        value: authorDisplay,
        inline: true,
      });
    }
  }

  // Campo de projeto (especialmente útil para DMs)
  if (payload.project) {
    const projectUrl = payload.project.url || '#';
    embed.addFields({
      name: '📁 Projeto',
      value: `[${payload.project.title}](${projectUrl})`,
      inline: true,
    });
  }

  // Campos específicos do contexto
  if (payload.context) {
    switch (payload.context.type) {
      case 'task':
        addTaskContextFields(embed, payload.context.data);
        break;

      case 'comment':
        embed.addFields({
          name: '💬 Comentário',
          value:
            payload.context.data.commentText.slice(0, 1000) ||
            '_Comentário vazio_', // Limite Discord
          inline: false,
        });
        break;

      case 'attachment':
        if (payload.context.data.fileName) {
          embed.addFields({
            name: '📎 Arquivo',
            value: payload.context.data.fileName,
            inline: true,
          });
        }
        break;

      case 'relation':
        embed.addFields({
          name: '🔗 Relação',
          value: `${formatRelationType(payload.context.data.relationType)}: ${payload.context.data.relatedTaskTitle || `Task #${payload.context.data.relatedTaskId}`}`,
          inline: false,
        });
        break;

      case 'team':
        if (payload.context.data.teamDescription) {
          embed.addFields({
            name: '📝 Descrição',
            value: payload.context.data.teamDescription.slice(0, 500),
            inline: false,
          });
        }
        if (payload.context.data.member) {
          embed.addFields({
            name: '👤 Membro',
            value: formatUserReference(payload.context.data.member),
            inline: true,
          });
        }
        break;

      case 'project':
        if (payload.context.data.owner) {
          embed.addFields({
            name: '👑 Proprietário',
            value: formatUserReference(payload.context.data.owner),
            inline: true,
          });
        }
        break;
    }
  }

  // Campos adicionais (retrocompatibilidade)
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
