/**
 * Button handler for task action buttons
 *
 * Handles button interactions from notification embeds
 */

import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ModalActionRowComponentBuilder,
} from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { TaskActionService } from '../services/task-action.service';
import type { UserMappingRepository } from '../../../shared/repositories/user-mapping.repository';
import { parseTaskActionCustomId, isTaskActionCustomId } from '../types';

export interface TaskActionButtonHandlerDeps {
  logger: ILogger;
  taskActionService: TaskActionService;
  userMappingRepository: UserMappingRepository;
}

export class TaskActionButtonHandler {
  private readonly logger: ILogger;
  private readonly taskActionService: TaskActionService;
  private readonly userMappingRepository: UserMappingRepository;

  constructor(deps: TaskActionButtonHandlerDeps) {
    this.logger = deps.logger;
    this.taskActionService = deps.taskActionService;
    this.userMappingRepository = deps.userMappingRepository;
  }

  /**
   * Verifica se este handler pode processar a interação
   */
  canHandle(customId: string): boolean {
    return isTaskActionCustomId(customId);
  }

  /**
   * Processa uma interação de botão de task action
   */
  async handle(interaction: ButtonInteraction): Promise<void> {
    const parsed = parseTaskActionCustomId(interaction.customId);

    if (!parsed) {
      this.logger.warn('Failed to parse task action custom ID', {
        customId: interaction.customId,
      });
      await interaction.reply({
        content: '❌ Ação inválida.',
        ephemeral: true,
      });
      return;
    }

    this.logger.debug('Handling task action button', {
      action: parsed.action,
      taskId: parsed.taskId,
      userId: interaction.user.id,
    });

    switch (parsed.action) {
      case 'mark_complete':
        await this.handleMarkComplete(interaction, parsed.taskId);
        break;

      case 'reopen':
        await this.handleReopen(interaction, parsed.taskId);
        break;

      case 'assign_me':
        await this.handleAssignMe(interaction, parsed.taskId);
        break;

      case 'reminder':
        await this.handleReminder(interaction, parsed.taskId);
        break;

      case 'due_date':
        await this.handleDueDate(interaction, parsed.taskId);
        break;

      default:
        await interaction.reply({
          content: '❌ Ação não implementada.',
          ephemeral: true,
        });
    }
  }

  private async handleMarkComplete(
    interaction: ButtonInteraction,
    taskId: number
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const result = await this.taskActionService.markComplete(taskId);

    if (result.success) {
      await interaction.editReply({
        content: `${result.message}\n📋 **${result.taskTitle}**`,
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.message}`,
      });
    }
  }

  private async handleReopen(
    interaction: ButtonInteraction,
    taskId: number
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const result = await this.taskActionService.reopenTask(taskId);

    if (result.success) {
      await interaction.editReply({
        content: `${result.message}\n📋 **${result.taskTitle}**`,
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.message}`,
      });
    }
  }

  private async handleAssignMe(
    interaction: ButtonInteraction,
    taskId: number
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    // Buscar mapeamento Discord -> Vikunja
    const vikunjaUserId = await this.userMappingRepository.findVikunjaUserId(
      interaction.user.id
    );

    if (!vikunjaUserId) {
      await interaction.editReply({
        content:
          '❌ Você precisa conectar sua conta Vikunja primeiro.\n' +
          '💡 Use o comando `/connect-account` para vincular sua conta.',
      });
      return;
    }

    const result = await this.taskActionService.assignToUser(
      taskId,
      vikunjaUserId
    );

    if (result.success) {
      await interaction.editReply({
        content: `${result.message}\n📋 **${result.taskTitle}**`,
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.message}`,
      });
    }
  }

  private async handleReminder(
    interaction: ButtonInteraction,
    taskId: number
  ): Promise<void> {
    await interaction.reply({
      content: '🔔 **Lembretes** serão implementados em uma próxima versão.',
      ephemeral: true,
    });
  }

  private async handleDueDate(
    interaction: ButtonInteraction,
    taskId: number
  ): Promise<void> {
    // Criar modal para input da data
    const modal = new ModalBuilder()
      .setCustomId(`task_action_modal:due_date:${taskId}`)
      .setTitle('Definir Due Date');

    const dateInput = new TextInputBuilder()
      .setCustomId('due_date_input')
      .setLabel('Nova Due Date (DD/MM/AAAA)')
      .setPlaceholder('Ex: 15/01/2026')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(10);

    const row =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        dateInput
      );

    modal.addComponents(row);

    await interaction.showModal(modal);
  }
}

export function createTaskActionButtonHandler(
  deps: TaskActionButtonHandlerDeps
): TaskActionButtonHandler {
  return new TaskActionButtonHandler(deps);
}
