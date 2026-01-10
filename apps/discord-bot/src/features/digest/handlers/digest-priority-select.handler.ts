/**
 * Digest Priority Select Handler
 *
 * Handles the minimum priority selection for digest creation.
 * Shows a select menu for choosing priority (0-5) with emojis,
 * then proceeds to type selection.
 */

import {
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ActionRowBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { ILogger } from '../../../shared/types';
import { showDigestTypeSelect } from './digest-type-select.handler';

// Custom ID prefixes
export const DIGEST_PRIORITY_SELECT_CUSTOM_ID = 'digest_priority_select';

export interface DigestPrioritySelectHandlerDeps {
  logger: ILogger;
}

/**
 * Check if this handler can process the interaction
 */
export function canHandleDigestPrioritySelect(customId: string): boolean {
  return customId.startsWith(`${DIGEST_PRIORITY_SELECT_CUSTOM_ID}:`);
}

/**
 * Shows the digest priority selection menu
 */
export async function showDigestPrioritySelect(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ChatInputCommandInteraction,
  projectId: number,
  targetType: 'dm' | 'guild',
  channelId?: string
): Promise<void> {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${DIGEST_PRIORITY_SELECT_CUSTOM_ID}:${projectId}:${targetType}:${channelId || 'null'}`)
    .setPlaceholder('Selecione a prioridade mínima')
    .addOptions([
      { label: '0 - Indefinida', value: '0', emoji: '⚪', description: 'Incluir todas as tarefas' },
      { label: '1 - Baixa', value: '1', emoji: '🔵', description: 'Tarefas de prioridade baixa ou superior' },
      { label: '2 - Média', value: '2', emoji: '🟢', description: 'Tarefas de prioridade média ou superior' },
      { label: '3 - Alta', value: '3', emoji: '🟡', description: 'Tarefas de prioridade alta ou superior' },
      { label: '4 - Urgente', value: '4', emoji: '🟠', description: 'Tarefas urgentes ou superior' },
      { label: '5 - Crítica', value: '5', emoji: '🔴', description: 'Apenas tarefas críticas' },
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const content = '📶 **Configurar Resumo**\nSelecione a prioridade mínima das tarefas a serem incluídas no resumo:';
  
  if (interaction.isChatInputCommand()) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content, components: [row] });
    } else {
      await interaction.reply({ content, components: [row], ephemeral: true });
    }
    return;
  }

  if (interaction.isMessageComponent()) {
      await interaction.update({ content, components: [row] });
  }
}

/**
 * Handle digest priority selection and show type select
 */
export async function handleDigestPrioritySelect(
  interaction: StringSelectMenuInteraction,
  deps: DigestPrioritySelectHandlerDeps
): Promise<void> {
  const { logger } = deps;

  // Parse customId: digest_priority_select:projectId:targetType:channelId
  const parts = interaction.customId.split(':');
  const projectId = parseInt(parts[1], 10);
  const targetType = parts[2] as 'dm' | 'guild';
  const channelId = parts[3] === 'null' ? undefined : parts[3];
  const priority = parseInt(interaction.values[0], 10);

  if (isNaN(projectId) || isNaN(priority)) {
    await interaction.reply({
      content: '❌ Dados inválidos.',
      ephemeral: true,
    });
    return;
  }

  logger.debug('Digest priority selected', { projectId, targetType, channelId, priority });

  // Proceed to Type Selection
  await showDigestTypeSelect(interaction, projectId, targetType, channelId, priority);
}
