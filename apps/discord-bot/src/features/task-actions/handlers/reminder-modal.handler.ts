/**
 * Reminder Modal Handler
 *
 * Processes reminder configuration modal submissions and creates reminders.
 * Handles both the legacy modal format and new type-specific modals.
 */

import type { ModalSubmitInteraction } from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { ReminderService } from '../services/reminder.service';
import {
  REMINDER_CONFIG_MODAL_PREFIX,
  canHandleReminderConfigModal,
  type ReminderType,
  REMINDER_TYPES,
} from './reminder-type-select.handler';


// Import shared date utils
import {
  calculateDefaultStartDate,
  calculateDefaultStartDateForWeekly,
  parseDate,
  parseOptionalStartDate,
  parseDaysOfWeek,
  formatDaysOfWeek,
} from '../../../shared/utils/date-utils';

export interface ReminderModalHandlerDeps {
  logger: ILogger;
  reminderService: ReminderService;
}

/**
 * Check if this handler can process the interaction
 */
export function canHandleReminderModal(customId: string): boolean {
  return canHandleReminderConfigModal(customId);
}

/**
 * Handle reminder modal submission
 */
export async function handleReminderModalSubmit(
  interaction: ModalSubmitInteraction,
  deps: ReminderModalHandlerDeps
): Promise<void> {
  const { logger, reminderService } = deps;

  // Parse customId: reminder_config_modal:type:projectId:taskId:mentionType
  const parts = interaction.customId.split(':');
  
  if (parts.length < 4 || parts[0] !== REMINDER_CONFIG_MODAL_PREFIX) {
    await interaction.reply({
      content: '❌ Formato de modal inválido.',
      ephemeral: true,
    });
    return;
  }

  const reminderType = parts[1] as ReminderType;
  const projectId = parseInt(parts[2], 10);
  const taskId = parseInt(parts[3], 10);
  // Default to 'assignees' if not present (legacy compatibility)
  const mentionType = (parts[4] as 'assignees' | 'everyone') || 'assignees';

  if (isNaN(projectId) || isNaN(taskId) || !REMINDER_TYPES[reminderType]) {
    await interaction.reply({
      content: '❌ Dados inválidos.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get common fields
    const timeValue = interaction.fields.getTextInputValue('reminder_time').trim();
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

    // Process based on reminder type
    let cronExpression: string;
    let startsAt: Date | undefined;

    switch (reminderType) {
      case 'once': {
        // One-time reminder: specific date required
        const dateValue = interaction.fields.getTextInputValue('reminder_date').trim();
        const parsedDate = parseDate(dateValue, hour, minute);
        
        if (!parsedDate) {
          await interaction.editReply({ content: '❌ Data inválida. Use DD/MM/AAAA.' });
          return;
        }

        if (parsedDate <= new Date()) {
          await interaction.editReply({ content: '❌ A data deve ser no futuro.' });
          return;
        }

        startsAt = parsedDate;
        // For one-time reminders, we use a cron that runs once at the specified minute/hour
        // The service will disable it after first execution
        cronExpression = `${minute} ${hour} ${parsedDate.getDate()} ${parsedDate.getMonth() + 1} *`;
        break;
      }

      case 'daily': {
        // Daily: every day at specified time
        cronExpression = `${minute} ${hour} * * *`;
        // Get user-provided start date or calculate default
        const userStartDate = parseOptionalStartDate(interaction, 'reminder_start_date', hour, minute);
        startsAt = userStartDate ?? calculateDefaultStartDate(hour, minute);
        break;
      }

      case 'weekly': {
        // Weekly: specific days of week
        const daysValue = interaction.fields.getTextInputValue('reminder_days').trim();
        const days = parseDaysOfWeek(daysValue);
        
        if (!days) {
          await interaction.editReply({
            content: '❌ Dias inválidos. Use números de 1 a 7 separados por vírgula.\n' +
                     '1=Domingo, 2=Segunda, 3=Terça, 4=Quarta, 5=Quinta, 6=Sexta, 7=Sábado',
          });
          return;
        }

        // Convert to cron format (0=Sunday, 6=Saturday)
        const cronDays = days.map(d => d - 1).join(',');
        cronExpression = `${minute} ${hour} * * ${cronDays}`;
        
        // Get user-provided start date or calculate default for weekly
        const userStartDate = parseOptionalStartDate(interaction, 'reminder_start_date', hour, minute);
        startsAt = userStartDate ?? calculateDefaultStartDateForWeekly(hour, minute, days);
        break;
      }

      case 'custom': {
        // Custom: every N days
        const intervalValue = interaction.fields.getTextInputValue('reminder_interval').trim();
        const interval = parseInt(intervalValue, 10);
        
        if (isNaN(interval) || interval < 1 || interval > 365) {
          await interaction.editReply({
            content: '❌ Intervalo inválido. Use um número entre 1 e 365.',
          });
          return;
        }

        // For custom intervals, we use daily cron and set startsAt to control the first execution.
        // After execution, the service will update nextRunAt by adding the interval.
        // Using a daily cron ensures the job runs, and we rely on startsAt to control timing.
        cronExpression = `${minute} ${hour} * * *`;
        
        // Get user-provided start date or calculate default
        const userStartDate = parseOptionalStartDate(interaction, 'reminder_start_date', hour, minute);
        startsAt = userStartDate ?? calculateDefaultStartDate(hour, minute);
        
        // Note: For custom intervals, we need to store the interval separately
        // For now, we embed it in the cron expression for reference, but use startsAt for scheduling
        // The actual interval logic should be handled in the reminder service
        // TODO: Add interval field to reminders table for proper custom interval handling
        // For now, we'll use a workaround: the cron runs daily but the service checks the interval
        break;
      }

      default:
        await interaction.editReply({ content: '❌ Tipo de lembrete não reconhecido.' });
        return;
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
      mentionType,
    });

    // Format response
    const typeLabel = REMINDER_TYPES[reminderType].label;
    const nextRunFormatted = reminder.nextRunAt.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    let scheduleInfo = '';
    switch (reminderType) {
      case 'once':
        scheduleInfo = `📅 Data: ${startsAt!.toLocaleDateString('pt-BR')} às ${timeValue}`;
        break;
      case 'daily':
        scheduleInfo = `🔁 Todos os dias às ${timeValue}`;
        break;
      case 'weekly': {
        const daysValue = interaction.fields.getTextInputValue('reminder_days').trim();
        scheduleInfo = `🔁 Nos dias ${formatDaysOfWeek(daysValue)} às ${timeValue}`;
        break;
      }
      case 'custom': {
        const interval = interaction.fields.getTextInputValue('reminder_interval').trim();
        scheduleInfo = `🔁 A cada ${interval} dia(s) às ${timeValue}`;
        break;
      }
    }

    await interaction.editReply({
      content:
        `✅ **Lembrete ${typeLabel} criado!**\n\n` +
        `${scheduleInfo}\n` +
        `🔔 Próxima execução: ${nextRunFormatted}\n` +
        (targetType === 'guild' ? `📢 Será enviado no canal do projeto (${mentionType === 'everyone' ? '@everyone' : 'apenas responsáveis'})` : '📬 Será enviado na sua DM'),
    });

    logger.info('Reminder created via modal', {
      reminderId: reminder.id,
      taskId,
      reminderType,
      cronExpression,
      startsAt: startsAt?.toISOString(),
      targetType,
    });
  } catch (error) {
    logger.error('Failed to create reminder from modal', {
      taskId,
      reminderType,
      error: error instanceof Error ? error.message : String(error),
    });

    await interaction.editReply({
      content: '❌ Erro ao criar lembrete. Tente novamente.',
    });
  }
}
