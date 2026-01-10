/**
 * Digest Modal Handler
 *
 * Processes digest configuration modal submissions and creates digests.
 * Matches logic from ReminderModalHandler but for Digests.
 */

import type { ModalSubmitInteraction } from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { DigestService } from '../services/digest.service';
import {
  DIGEST_CONFIG_MODAL_PREFIX,
  canHandleDigestConfigModal,
  type DigestType,
  DIGEST_TYPES,
} from './digest-type-select.handler';


// Import shared date utils
import {
  calculateDefaultStartDate,
  calculateDefaultStartDateForWeekly,
  parseDate,
  parseOptionalStartDate,
  parseDaysOfWeek,
  formatDaysOfWeek,
} from '../../../shared/utils/date-utils';

export interface DigestModalHandlerDeps {
  logger: ILogger;
  digestService: DigestService;
}

/**
 * Check if this handler can process the interaction
 */
export function canHandleDigestModal(customId: string): boolean {
  return canHandleDigestConfigModal(customId);
}

/**
 * Handle digest modal submission
 */
export async function handleDigestModalSubmit(
  interaction: ModalSubmitInteraction,
  deps: DigestModalHandlerDeps
): Promise<void> {
  const { logger, digestService } = deps;

  // Parse customId: digest_config_modal:type:projectId:targetType:channelId:minPriority
  const parts = interaction.customId.split(':');
  
  if (parts.length < 6 || parts[0] !== DIGEST_CONFIG_MODAL_PREFIX) {
    await interaction.reply({
      content: '❌ Formato de modal inválido.',
      ephemeral: true,
    });
    return;
  }

  const digestType = parts[1] as DigestType;
  const projectId = parseInt(parts[2], 10);
  const targetType = parts[3] as 'dm' | 'guild';
  const channelId = parts[4] === 'null' ? undefined : parts[4];
  const minPriority = parseInt(parts[5], 10) || 0;

  if (isNaN(projectId) || !DIGEST_TYPES[digestType]) {
    await interaction.reply({
      content: '❌ Dados inválidos.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get common fields
    const timeValue = interaction.fields.getTextInputValue('digest_time').trim();
    // Priority is now from customId

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

    let cronExpression: string;
    let startsAt: Date | undefined;

    switch (digestType) {


      case 'daily': {
        cronExpression = `${minute} ${hour} * * *`;
        const userStartDate = parseOptionalStartDate(interaction, 'digest_start_date', hour, minute);
        startsAt = userStartDate ?? calculateDefaultStartDate(hour, minute);
        break;
      }

      case 'weekly': {
        const daysValue = interaction.fields.getTextInputValue('digest_days').trim();
        const days = parseDaysOfWeek(daysValue);
        
        if (!days) {
          await interaction.editReply({
            content: '❌ Dias inválidos. Use números de 1 a 7 separados por vírgula.\n' +
                     '1=Domingo, 2=Segunda, 3=Terça, 4=Quarta, 5=Quinta, 6=Sexta, 7=Sábado',
          });
          return;
        }

        const cronDays = days.map(d => d - 1).join(',');

        cronExpression = `${minute} ${hour} * * ${cronDays}`;
        const userStartDate = parseOptionalStartDate(interaction, 'digest_start_date', hour, minute);
        startsAt = userStartDate ?? calculateDefaultStartDateForWeekly(hour, minute, days);
        break;
      }

      case 'custom': {
        const intervalValue = interaction.fields.getTextInputValue('digest_interval').trim();
        const interval = parseInt(intervalValue, 10);
        
        if (isNaN(interval) || interval < 1 || interval > 365) {
          await interaction.editReply({
            content: '❌ Intervalo inválido. Use um número entre 1 e 365.',
          });
          return;
        }
        
        // For custom, we use daily cron but service manages intervals (simplification)
        cronExpression = `${minute} ${hour} * * *`;
        const userStartDate = parseOptionalStartDate(interaction, 'digest_start_date', hour, minute);
        startsAt = userStartDate ?? calculateDefaultStartDate(hour, minute);
        break;
      }

      default:
        await interaction.editReply({ content: '❌ Tipo de resumo não reconhecido.' });
        return;
    }

    // Create digest
    const digest = await digestService.createDigest({
      discordUserId: interaction.user.id,
      vikunjaProjectId: projectId,
      targetType,
      guildId: interaction.guildId || undefined,
      channelId,
      cronExpression,

      minPriority,
      startsAt,
    });

    const typeLabel = DIGEST_TYPES[digestType].label;
    const nextRunFormatted = digest.nextRunAt.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    let scheduleInfo = '';
    switch (digestType) {

      case 'daily':
        scheduleInfo = `🔁 Todos os dias às ${timeValue}`;
        break;
      case 'weekly': {
        const daysValue = interaction.fields.getTextInputValue('digest_days').trim();
        scheduleInfo = `🔁 Nos dias ${formatDaysOfWeek(daysValue)} às ${timeValue}`;
        break;
      }
      case 'custom': {
        const interval = interaction.fields.getTextInputValue('digest_interval').trim();
        scheduleInfo = `🔁 A cada ${interval} dia(s) às ${timeValue}`;
        break;
      }
    }

    await interaction.editReply({
      content:
        `✅ **Resumo ${typeLabel} configurado!**\n\n` +
        `${scheduleInfo}\n` +
        `🔔 Próxima execução: ${nextRunFormatted}\n` +
        `🎯 Prioridade Mínima: ${minPriority}\n` + 
        (targetType === 'guild' ? `📢 Será enviado neste servidor` : '📬 Será enviado na sua DM'),
    });

    logger.info('Digest created via modal', {
      digestId: digest.id,
      projectId,
      digestType,
      cronExpression,
      targetType,
    });
  } catch (error) {
    logger.error('Failed to create digest from modal', {
      projectId,
      digestType,
      error: error instanceof Error ? error.message : String(error),
    });

    await interaction.editReply({
      content: '❌ Erro ao criar resumo. Tente novamente.',
    });
  }
}
