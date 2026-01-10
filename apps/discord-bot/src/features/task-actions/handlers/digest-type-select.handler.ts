/**
 * Digest Type Select Handler
 *
 * Handles the frequency selection for digest creation.
 * Shows a select menu for choosing digest frequency (Once, Daily, Weekly, Custom),
 * then displays type-specific modals for configuration.
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
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { ILogger } from '../../../shared/types';

// Custom ID prefixes
export const DIGEST_TYPE_SELECT_CUSTOM_ID = 'digest_type_select';
export const DIGEST_CONFIG_MODAL_PREFIX = 'digest_config_modal';

/**
 * Digest type definitions
 */
export const DIGEST_TYPES = {
  daily: {
    label: '📅 Diário',
    description: 'Resumo todos os dias no mesmo horário',
    emoji: '📅',
  },
  weekly: {
    label: '📆 Semanal',
    description: 'Resumo nos dias da semana escolhidos',
    emoji: '📆',
  },
  custom: {
    label: '⚙️ Customizado',
    description: 'Intervalo personalizado em dias',
    emoji: '⚙️',
  },
} as const;

export type DigestType = keyof typeof DIGEST_TYPES;

export interface DigestTypeSelectHandlerDeps {
  logger: ILogger;
}

/**
 * Check if this handler can process the interaction (select menu)
 */
export function canHandleDigestTypeSelect(customId: string): boolean {
  return customId.startsWith(`${DIGEST_TYPE_SELECT_CUSTOM_ID}:`);
}

/**
 * Check if this handler can process the modal submission
 */
export function canHandleDigestConfigModal(customId: string): boolean {
  return customId.startsWith(`${DIGEST_CONFIG_MODAL_PREFIX}:`);
}

/**
 * Shows the digest type selection menu
 */
export async function showDigestTypeSelect(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ChatInputCommandInteraction,
  projectId: number,
  targetType: 'dm' | 'guild',
  channelId?: string,
  minPriority: number = 0
): Promise<void> {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${DIGEST_TYPE_SELECT_CUSTOM_ID}:${projectId}:${targetType}:${channelId || 'null'}:${minPriority}`)
    .setPlaceholder('Selecione a frequência do resumo')
    .addOptions(
      Object.entries(DIGEST_TYPES).map(([value, config]) => ({
        label: config.label,
        description: config.description,
        value,
        emoji: config.emoji,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const content = '⏰ **Configurar Resumo**\nEscolha a frequência de envio do resumo:';
  
  if (interaction.isChatInputCommand()) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content, components: [row] });
    } else {
      await interaction.reply({ content, components: [row], ephemeral: true });
    }
    return;
  }

  if (interaction.isMessageComponent()) {
      // StringSelectMenuInteraction or ButtonInteraction always have update
      await interaction.update({ content, components: [row] });
  }
}

/**
 * Handle digest type selection and show appropriate modal
 */
export async function handleDigestTypeSelect(
  interaction: StringSelectMenuInteraction,
  deps: DigestTypeSelectHandlerDeps
): Promise<void> {
  const { logger } = deps;

  // Parse customId: digest_type_select:projectId:targetType:channelId:minPriority
  const parts = interaction.customId.split(':');
  const projectId = parseInt(parts[1], 10);
  const targetType = parts[2] as 'dm' | 'guild';
  const channelId = parts[3] === 'null' ? undefined : parts[3];
  const minPriority = parseInt(parts[4] || '0', 10);
  const selectedType = interaction.values[0] as DigestType;

  if (isNaN(projectId)) {
    await interaction.reply({
      content: '❌ Dados inválidos.',
      ephemeral: true,
    });
    return;
  }

  logger.debug('Digest type selected', { projectId, targetType, channelId, type: selectedType, minPriority });

  const modal = createDigestConfigModal(selectedType, projectId, targetType, channelId, minPriority);
  await interaction.showModal(modal);
}

/**
 * Create the appropriate modal based on digest type
 */
function createDigestConfigModal(
  type: DigestType,
  projectId: number,
  targetType: 'dm' | 'guild',
  channelId?: string,
  minPriority: number = 0
): ModalBuilder {
  const typeConfig = DIGEST_TYPES[type];
  // Encode info in customId: digest_config_modal:type:projectId:targetType:channelId:minPriority
  const modal = new ModalBuilder()
    .setCustomId(`${DIGEST_CONFIG_MODAL_PREFIX}:${type}:${projectId}:${targetType}:${channelId || 'null'}:${minPriority}`)
    .setTitle(`Configurar Resumo ${typeConfig.label}`);

  // Common: Time input
  const timeInput = new TextInputBuilder()
    .setCustomId('digest_time')
    .setLabel('Horário (HH:MM)')
    .setPlaceholder('09:00')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(5);

  // Type-specific fields
  switch (type) {
    case 'daily': {
      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(timeInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(createStartDateInput())
      );
      break;
    }

    case 'weekly': {
      const daysInput = new TextInputBuilder()
        .setCustomId('digest_days')
        .setLabel('Dias da semana (1=Dom, 2=Seg... 7=Sáb)')
        .setPlaceholder('2,3,4,5,6 (ex: Seg a Sex)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(13);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(timeInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(daysInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(createStartDateInput())
      );
      break;
    }

    case 'custom': {
      const intervalInput = new TextInputBuilder()
        .setCustomId('digest_interval')
        .setLabel('Intervalo em dias (1-365)')
        .setPlaceholder('7 (ex: a cada 7 dias)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(timeInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(intervalInput),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(createStartDateInput())
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
    .setCustomId('digest_start_date')
    .setLabel('A partir de (DD/MM/AAAA) - opcional')
    .setPlaceholder('Deixe vazio para começar agora')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
}
