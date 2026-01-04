/**
 * Modal handler for task action modals
 *
 * Handles modal submissions for task actions (e.g., due date input)
 */

import type { ModalSubmitInteraction } from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { TaskActionService } from '../services/task-action.service';

const MODAL_PREFIX = 'task_action_modal';

export interface TaskActionModalHandlerDeps {
  logger: ILogger;
  taskActionService: TaskActionService;
}

export class TaskActionModalHandler {
  private readonly logger: ILogger;
  private readonly taskActionService: TaskActionService;

  constructor(deps: TaskActionModalHandlerDeps) {
    this.logger = deps.logger;
    this.taskActionService = deps.taskActionService;
  }

  /**
   * Verifica se este handler pode processar a interação
   */
  canHandle(customId: string): boolean {
    return customId.startsWith(`${MODAL_PREFIX}:`);
  }

  /**
   * Processa uma submissão de modal de task action
   */
  async handle(interaction: ModalSubmitInteraction): Promise<void> {
    const parts = interaction.customId.split(':');

    if (parts.length < 3) {
      this.logger.warn('Invalid modal custom ID', {
        customId: interaction.customId,
      });
      await interaction.reply({
        content: '❌ Modal inválido.',
        ephemeral: true,
      });
      return;
    }

    const action = parts[1];
    const taskId = parseInt(parts[2], 10);

    if (isNaN(taskId)) {
      await interaction.reply({
        content: '❌ ID da task inválido.',
        ephemeral: true,
      });
      return;
    }

    switch (action) {
      case 'due_date':
        await this.handleDueDateSubmit(interaction, taskId);
        break;

      default:
        await interaction.reply({
          content: '❌ Ação não implementada.',
          ephemeral: true,
        });
    }
  }

  private async handleDueDateSubmit(
    interaction: ModalSubmitInteraction,
    taskId: number
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const dateInput = interaction.fields.getTextInputValue('due_date_input');

    // Parsear data no formato DD/MM/AAAA
    const dateParts = dateInput.split('/');
    if (dateParts.length !== 3) {
      await interaction.editReply({
        content: '❌ Formato de data inválido. Use DD/MM/AAAA.',
      });
      return;
    }

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
    const year = parseInt(dateParts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      await interaction.editReply({
        content: '❌ Formato de data inválido. Use DD/MM/AAAA.',
      });
      return;
    }

    const dueDate = new Date(year, month, day, 23, 59, 59);

    // Validar que a data é válida
    if (isNaN(dueDate.getTime())) {
      await interaction.editReply({
        content: '❌ Data inválida.',
      });
      return;
    }

    const result = await this.taskActionService.updateDueDate(taskId, dueDate);

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
}

export function createTaskActionModalHandler(
  deps: TaskActionModalHandlerDeps
): TaskActionModalHandler {
  return new TaskActionModalHandler(deps);
}
