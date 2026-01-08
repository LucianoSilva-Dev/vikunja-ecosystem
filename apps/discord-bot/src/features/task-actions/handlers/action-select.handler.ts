/**
 * Action Select Handler
 *
 * Handles action selection from /task command and executes the chosen action
 */

import {
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ModalActionRowComponentBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { TaskActionService } from '../services/task-action.service';
import type { UserMappingRepository } from '../../../shared/repositories/user-mapping.repository';
import type { ReminderRepository } from '../repositories/reminder.repository';
import { showReminderTypeSelect } from './reminder-type-select.handler';

export const REMINDER_MODAL_CUSTOM_ID = 'task_reminder_modal';

export interface ActionSelectHandlerDeps {
  logger: ILogger;
  taskActionService: TaskActionService;
  userMappingRepository: UserMappingRepository;
  reminderRepository: ReminderRepository;
}

/**
 * Handle action selection from /task command
 */
export async function handleTaskActionSelect(
  interaction: StringSelectMenuInteraction,
  deps: ActionSelectHandlerDeps
): Promise<void> {
  const { logger, taskActionService, userMappingRepository, reminderRepository } = deps;

  // Parse customId: task_cmd_action_select:projectId:taskId
  const customIdParts = interaction.customId.split(':');
  const projectId = parseInt(customIdParts[1], 10);
  const taskId = parseInt(customIdParts[2], 10);
  const action = interaction.values[0];

  logger.debug('Task command: action selected', { projectId, taskId, action });

  switch (action) {
    case 'mark_complete':
      await handleMarkComplete(interaction, taskId, taskActionService);
      break;

    case 'reopen':
      await handleReopen(interaction, taskId, taskActionService);
      break;

    case 'assign_me':
      await handleAssignMe(interaction, taskId, taskActionService, userMappingRepository, logger);
      break;

    case 'due_date':
      await showDueDateModal(interaction, taskId, projectId);
      break;

    case 'reminder':
      await showReminderModal(interaction, taskId, projectId);
      break;

    case 'delete_reminders':
      await showDeleteRemindersMenu(interaction, taskId, projectId, reminderRepository);
      break;

    default:
      await interaction.reply({
        content: '❌ Ação não reconhecida.',
        ephemeral: true,
      });
  }
}

async function handleMarkComplete(
  interaction: StringSelectMenuInteraction,
  taskId: number,
  taskActionService: TaskActionService
): Promise<void> {
  await interaction.deferUpdate();

  const result = await taskActionService.markComplete(taskId);

  await interaction.editReply({
    content: result.success
      ? `${result.message}\n📋 **${result.taskTitle}**`
      : `❌ ${result.message}`,
    embeds: [],
    components: [],
  });
}

async function handleReopen(
  interaction: StringSelectMenuInteraction,
  taskId: number,
  taskActionService: TaskActionService
): Promise<void> {
  await interaction.deferUpdate();

  const result = await taskActionService.reopenTask(taskId);

  await interaction.editReply({
    content: result.success
      ? `${result.message}\n📋 **${result.taskTitle}**`
      : `❌ ${result.message}`,
    embeds: [],
    components: [],
  });
}

async function handleAssignMe(
  interaction: StringSelectMenuInteraction,
  taskId: number,
  taskActionService: TaskActionService,
  userMappingRepository: UserMappingRepository,
  logger: ILogger
): Promise<void> {
  await interaction.deferUpdate();

  const vikunjaUserId = await userMappingRepository.findVikunjaUserId(
    interaction.user.id
  );

  if (!vikunjaUserId) {
    await interaction.editReply({
      content:
        '❌ Você precisa conectar sua conta Vikunja primeiro.\n' +
        '💡 Use `/connect-account` para vincular sua conta.',
      embeds: [],
      components: [],
    });
    return;
  }

  const result = await taskActionService.assignToUser(taskId, vikunjaUserId);

  await interaction.editReply({
    content: result.success
      ? `${result.message}\n📋 **${result.taskTitle}**`
      : `❌ ${result.message}`,
    embeds: [],
    components: [],
  });
}

async function showDueDateModal(
  interaction: StringSelectMenuInteraction,
  taskId: number,
  projectId: number
): Promise<void> {
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

  const row = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
    dateInput
  );

  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function showReminderModal(
  interaction: StringSelectMenuInteraction,
  taskId: number,
  projectId: number
): Promise<void> {
  // Use the new two-step flow: first show type selection, then show type-specific modal
  await showReminderTypeSelect(interaction, projectId, taskId);
}

async function showDeleteRemindersMenu(
  interaction: StringSelectMenuInteraction,
  taskId: number,
  projectId: number,
  reminderRepository: ReminderRepository
): Promise<void> {
  const reminders = await reminderRepository.findByTaskId(taskId);

  if (reminders.length === 0) {
    await interaction.reply({
      content: '❌ Nenhum lembrete encontrado para remover.',
      ephemeral: true,
    });
    return;
  }

  // Build select menu for reminders to delete
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`task_reminder_delete:${projectId}:${taskId}`)
    .setPlaceholder('Selecione os lembretes para remover')
    .setMinValues(1)
    .setMaxValues(reminders.length)
    .addOptions(
      reminders.map((r) => {
        const nextRun = new Date(r.nextRunAt).toLocaleString('pt-BR');
        // Parse cron to human readable
        let typeLabel = 'Lembrete';
        const cronParts = r.cronExpression.split(' ');
        if (cronParts.length >= 5) {
          if (cronParts[2] === '*' && cronParts[3] === '*' && cronParts[4] === '*') {
            typeLabel = `Diário às ${cronParts[1]}:${cronParts[0].padStart(2, '0')}`;
          } else if (cronParts[4] === '1-5') {
            typeLabel = `Dias úteis às ${cronParts[1]}:${cronParts[0].padStart(2, '0')}`;
          } else if (cronParts[4] !== '*') {
            typeLabel = `Semanal às ${cronParts[1]}:${cronParts[0].padStart(2, '0')}`;
          } else if (cronParts[1] === '*') {
            typeLabel = `A cada hora (min ${cronParts[0]})`;
          }
        }
        return {
          label: typeLabel.slice(0, 100),
          value: String(r.id),
          description: `Próximo: ${nextRun}`.slice(0, 100),
          emoji: '⏰',
        };
      })
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: '🗑️ Selecione quais lembretes deseja remover:',
    components: [row],
    ephemeral: true,
  });
}

export async function handleDeleteRemindersSubmit(
  interaction: StringSelectMenuInteraction,
  deps: ActionSelectHandlerDeps
): Promise<void> {
  const { logger, reminderRepository } = deps;
  const reminderIds = interaction.values.map((v) => parseInt(v, 10));

  await interaction.deferUpdate();

  try {
    let deletedCount = 0;
    for (const id of reminderIds) {
      if (await reminderRepository.delete(id)) {
        deletedCount++;
      }
    }

    await interaction.editReply({
      content: `✅ ${deletedCount} lembrete(s) removido(s) com sucesso!`,
      components: [],
    });
  } catch (error) {
    logger.error('Failed to delete reminders', {
      reminderIds,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply({
      content: '❌ Erro ao remover lembretes.',
      components: [],
    });
  }
}
