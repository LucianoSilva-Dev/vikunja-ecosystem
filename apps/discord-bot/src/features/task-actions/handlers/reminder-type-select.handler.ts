/**
 * Reminder Type Select Handler
 *
 * Handles the first step of the two-step reminder creation flow.
 * Shows a select menu for choosing reminder type, then displays
 * type-specific modals for configuration.
 */

import {
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalActionRowComponentBuilder,
  type ButtonInteraction,
  type MessageComponentInteraction,
} from 'discord.js';
import type { ILogger } from '../../../shared/types';

// Custom ID prefixes
export const REMINDER_TYPE_SELECT_CUSTOM_ID = 'reminder_type_select';
export const REMINDER_MENTION_SELECT_CUSTOM_ID = 'reminder_mention_select';
export const REMINDER_CONFIG_MODAL_PREFIX = 'reminder_config_modal';

/**
 * Reminder type definitions with labels and descriptions
 */
export const REMINDER_TYPES = {
  once: {
    label: '🔔 Único',
    description: 'Lembra apenas uma vez no horário definido',
    emoji: '🔔',
  },
  daily: {
    label: '📅 Diário',
    description: 'Lembra todos os dias no mesmo horário',
    emoji: '📅',
  },
  weekly: {
    label: '📆 Semanal',
    description: 'Lembra nos dias da semana escolhidos (1-7)',
    emoji: '📆',
  },
  custom: {
    label: '⚙️ Customizado',
    description: 'Personaliza o intervalo em dias',
    emoji: '⚙️',
  },
} as const;

export type ReminderType = keyof typeof REMINDER_TYPES;
export type MentionType = 'assignees' | 'everyone';

export interface ReminderTypeSelectHandlerDeps {
  logger: ILogger;
}

/**
 * Check if this handler can process the interaction (select menu)
 */
export function canHandleReminderTypeSelect(customId: string): boolean {
  return customId.startsWith(`${REMINDER_TYPE_SELECT_CUSTOM_ID}:`);
}

/**
 * Check if this handler can process the mention selection (select menu)
 */
export function canHandleReminderMentionSelect(customId: string): boolean {
  return customId.startsWith(`${REMINDER_MENTION_SELECT_CUSTOM_ID}:`);
}

/**
 * Check if this handler can process the modal submission
 */
export function canHandleReminderConfigModal(customId: string): boolean {
  return customId.startsWith(`${REMINDER_CONFIG_MODAL_PREFIX}:`);
}

/**
 * Shows the reminder type selection menu
 * Called from both /task command and notification button handlers
 */
export async function showReminderTypeSelect(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  projectId: number,
  taskId: number
): Promise<void> {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${REMINDER_TYPE_SELECT_CUSTOM_ID}:${projectId}:${taskId}`)
    .setPlaceholder('Selecione o tipo de lembrete')
    .addOptions(
      Object.entries(REMINDER_TYPES).map(([value, config]) => ({
        label: config.label,
        description: config.description,
        value,
        emoji: config.emoji,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: '⏰ **Criar Lembrete**\nEscolha como deseja ser lembrado:',
    components: [row],
    ephemeral: true,
  });
}

/**
 * Handle reminder type selection and show appropriate modal or next step
 */
export async function handleReminderTypeSelect(
  interaction: StringSelectMenuInteraction,
  deps: ReminderTypeSelectHandlerDeps
): Promise<void> {
  const { logger } = deps;

  // Parse customId: reminder_type_select:projectId:taskId
  const parts = interaction.customId.split(':');
  const projectId = parseInt(parts[1], 10);
  const taskId = parseInt(parts[2], 10);
  const selectedType = interaction.values[0] as ReminderType;

  if (isNaN(projectId) || isNaN(taskId)) {
    await interaction.reply({
      content: '❌ Dados inválidos.',
      ephemeral: true,
    });
    return;
  }

  logger.debug('Reminder type selected', { projectId, taskId, type: selectedType });

  // If in a guild, offer mention options via Dropdown
  if (interaction.guildId) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`${REMINDER_MENTION_SELECT_CUSTOM_ID}:${selectedType}:${projectId}:${taskId}`)
      .setPlaceholder('Quem deve ser mencionado?')
      .addOptions([
        {
          label: 'Apenas Responsáveis',
          description: 'Menciona apenas os usuários atribuídos à tarefa',
          value: 'assignees',
          emoji: '👤',
        },
        {
          label: '@everyone',
          description: 'Menciona todos no canal (@everyone)',
          value: 'everyone',
          emoji: '📢',
        },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.update({
      content: '👥 **Quem devo avisar?**\nSelecione quem será mencionado no lembrete:',
      components: [row],
    });
    return;
  }

  // If DM, default to assignees (which means user) and show modal
  const modal = createReminderConfigModal(selectedType, projectId, taskId, 'assignees');
  await interaction.showModal(modal);
}

/**
 * Handle reminder mention selection and show modal
 */
export async function handleReminderMentionSelect(
  interaction: StringSelectMenuInteraction,
  deps: ReminderTypeSelectHandlerDeps
): Promise<void> {
  const { logger } = deps;

  // Parse customId: reminder_mention_select:type:projectId:taskId
  const parts = interaction.customId.split(':');
  const reminderType = parts[1] as ReminderType;
  const projectId = parseInt(parts[2], 10);
  const taskId = parseInt(parts[3], 10);
  const mentionType = interaction.values[0] as MentionType;

  if (isNaN(projectId) || isNaN(taskId) || !REMINDER_TYPES[reminderType]) {
    await interaction.reply({
      content: '❌ Dados inválidos.',
      ephemeral: true,
    });
    return;
  }

  logger.debug('Reminder mention type selected', { projectId, taskId, reminderType, mentionType });

  const modal = createReminderConfigModal(reminderType, projectId, taskId, mentionType);
  await interaction.showModal(modal);
}

/**
 * Create the appropriate modal based on reminder type
 */
function createReminderConfigModal(
  type: ReminderType,
  projectId: number,
  taskId: number,
  mentionType: MentionType
): ModalBuilder {
  const typeConfig = REMINDER_TYPES[type];
  // Encode mentionType in customId: reminder_config_modal:type:projectId:taskId:mentionType
  const modal = new ModalBuilder()
    .setCustomId(`${REMINDER_CONFIG_MODAL_PREFIX}:${type}:${projectId}:${taskId}:${mentionType}`)
    .setTitle(`Configurar Lembrete ${typeConfig.label}`);

  // Common: Time input (all types except 'once' which may have a different flow)
  const timeInput = new TextInputBuilder()
    .setCustomId('reminder_time')
    .setLabel('Horário (HH:MM)')
    .setPlaceholder('09:00')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(5);

  // Type-specific fields
  switch (type) {
    case 'once': {
      // Once: requires date (mandatory)
      const dateInput = new TextInputBuilder()
        .setCustomId('reminder_date')
        .setLabel('Data (DD/MM/AAAA)')
        .setPlaceholder('15/01/2026')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(10);

      const messageInput = createMessageInput();

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(timeInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(dateInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageInput)
      );
      break;
    }

    case 'daily': {
      // Daily: optional start date
      const startDateInput = createStartDateInput();
      const messageInput = createMessageInput();

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(timeInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(startDateInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageInput)
      );
      break;
    }

    case 'weekly': {
      // Weekly: days of week (1-7) + optional start date
      const daysInput = new TextInputBuilder()
        .setCustomId('reminder_days')
        .setLabel('Dias da semana (1=Dom, 2=Seg... 7=Sáb)')
        .setPlaceholder('2,3,4,5,6 (ex: Seg a Sex)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(13); // "1,2,3,4,5,6,7"

      const startDateInput = createStartDateInput();
      const messageInput = createMessageInput();

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(timeInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(daysInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(startDateInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageInput)
      );
      break;
    }

    case 'custom': {
      // Custom: interval in days + optional start date
      const intervalInput = new TextInputBuilder()
        .setCustomId('reminder_interval')
        .setLabel('Intervalo em dias (1-365)')
        .setPlaceholder('7 (ex: a cada 7 dias)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3);

      const startDateInput = createStartDateInput();
      const messageInput = createMessageInput();

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(timeInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(intervalInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(startDateInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(messageInput)
      );
      break;
    }
  }

  return modal;
}

/**
 * Helper: Create start date input (optional)
 */
function createStartDateInput(): TextInputBuilder {
  return new TextInputBuilder()
    .setCustomId('reminder_start_date')
    .setLabel('A partir de (DD/MM/AAAA) - opcional')
    .setPlaceholder('Deixe vazio para começar agora')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
}

/**
 * Helper: Create message input (optional)
 */
function createMessageInput(): TextInputBuilder {
  return new TextInputBuilder()
    .setCustomId('reminder_message')
    .setLabel('Mensagem personalizada (opcional)')
    .setPlaceholder('Lembre-se de revisar...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);
}
