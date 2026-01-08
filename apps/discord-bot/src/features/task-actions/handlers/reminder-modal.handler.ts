/**
 * Reminder Modal Handler
 *
 * Processes reminder modal submissions and creates reminders
 */

import type { ModalSubmitInteraction } from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { ReminderService } from '../services/reminder.service';
import { REMINDER_MODAL_CUSTOM_ID } from './action-select.handler';

export interface ReminderModalHandlerDeps {
  logger: ILogger;
  reminderService: ReminderService;
}

/**
 * Check if this handler can process the interaction
 */
export function canHandleReminderModal(customId: string): boolean {
  return customId.startsWith(`${REMINDER_MODAL_CUSTOM_ID}:`);
}

/**
 * Handle reminder modal submission
 */
export async function handleReminderModalSubmit(
  interaction: ModalSubmitInteraction,
  deps: ReminderModalHandlerDeps
): Promise<void> {
  const { logger, reminderService } = deps;

  // Parse customId: task_reminder_modal:projectId:taskId
  const parts = interaction.customId.split(':');
  const projectId = parseInt(parts[1], 10);
  const taskId = parseInt(parts[2], 10);

  if (isNaN(projectId) || isNaN(taskId)) {
    await interaction.reply({
      content: '❌ Dados inválidos.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get form values
    const reminderType = interaction.fields.getTextInputValue('reminder_type').toLowerCase().trim();
    const timeValue = interaction.fields.getTextInputValue('reminder_time').trim();
    const startDateValue = interaction.fields.getTextInputValue('reminder_start_date')?.trim();
    const message = interaction.fields.getTextInputValue('reminder_message')?.trim() || undefined;

    // Parse time (HH:MM)
    const timeParts = timeValue.split(':');
    if (timeParts.length !== 2) {
      await interaction.editReply({ content: '❌ Formato de horário inválido. Use HH:MM.' });
      return;
    }
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      await interaction.editReply({ content: '❌ Horário inválido.' });
      return;
    }

    // Parse cron expression based on type
    let cronExpression: string;

    if (reminderType.startsWith('cron:') || reminderType.includes('*')) {
      // Custom cron expression
      cronExpression = reminderType.replace('cron:', '').trim();
    } else {
      // Predefined types
      switch (reminderType) {
        case 'hora':
        case 'hourly':
          cronExpression = `${minute} * * * *`; // Every hour at minute
          break;

        case 'diario':
        case 'daily':
          cronExpression = `${minute} ${hour} * * *`; // Every day at time
          break;

        case 'semanal':
        case 'weekly':
          cronExpression = `${minute} ${hour} * * 1`; // Every Monday at time
          break;

        case 'dias_uteis':
        case 'weekdays':
          cronExpression = `${minute} ${hour} * * 1-5`; // Mon-Fri at time
          break;

        default:
          // Try to parse as cron directly
          if (reminderType.split(' ').length >= 5) {
            cronExpression = reminderType;
          } else {
            await interaction.editReply({
              content: '❌ Tipo inválido. Use: hora, diario, semanal, dias_uteis ou cron expression.',
            });
            return;
          }
      }
    }

    // Parse start date if provided
    let startsAt: Date | undefined;
    if (startDateValue) {
      const dateParts = startDateValue.split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        startsAt = new Date(year, month, day, hour, minute);

        if (isNaN(startsAt.getTime())) {
          await interaction.editReply({ content: '❌ Data de início inválida.' });
          return;
        }
      }
    }

    // Determine target type
    const targetType = interaction.guildId ? 'guild' : 'dm';

    // Create reminder
    const reminder = await reminderService.createReminder({
      discordUserId: interaction.user.id,
      vikunjaTaskId: taskId,
      vikunjaProjectId: projectId,
      targetType,
      guildId: interaction.guildId || undefined,
      cronExpression,
      startsAt,
      message,
    });

    const nextRunFormatted = reminder.nextRunAt.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    await interaction.editReply({
      content:
        `✅ **Lembrete criado!**\n\n` +
        `🔔 Próxima execução: ${nextRunFormatted}\n` +
        `⏰ Padrão: \`${cronExpression}\`\n` +
        (targetType === 'guild' ? '📢 Será enviado no canal do projeto' : '📬 Será enviado na sua DM'),
    });

    logger.info('Reminder created via modal', {
      reminderId: reminder.id,
      taskId,
      cronExpression,
      targetType,
    });
  } catch (error) {
    logger.error('Failed to create reminder from modal', {
      taskId,
      error: error instanceof Error ? error.message : String(error),
    });

    await interaction.editReply({
      content: '❌ Erro ao criar lembrete. Verifique a expressão cron.',
    });
  }
}
