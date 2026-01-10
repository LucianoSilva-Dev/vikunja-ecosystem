import { ChatInputCommandInteraction } from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { DigestService } from '../services/digest.service';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';
import { buildDigestListEmbed, getProjectMap } from '../utils/digest-utils';

interface DigestListDeps {
  logger: ILogger;
  digestService: DigestService;
  vikunjaApiService: VikunjaApiService;
}

export async function handleDigestList(
  interaction: ChatInputCommandInteraction,
  deps: DigestListDeps
): Promise<void> {
  const { logger, digestService, vikunjaApiService } = deps;
  const discordUserId = interaction.user.id;
  const guildId = interaction.guildId;

  logger.info('Listing digests', { userId: discordUserId, guildId });
  await interaction.deferReply({ ephemeral: true });

  try {
    const allDigests = await digestService.getUserDigests(discordUserId);
    
    // Filter digests based on context
    const digests = allDigests.filter(d => {
        if (guildId) {
            return d.targetType === 'guild' && d.guildId === guildId;
        } else {
            return d.targetType === 'dm';
        }
    });
    
    if (digests.length === 0) {
        await interaction.editReply({ content: '📭 Nenhum resumo configurado para este contexto.' });
        return;
    }

    // Fetch project map
    const projectMap = await getProjectMap(vikunjaApiService, logger);

    const embed = buildDigestListEmbed({
        digests,
        projectMap,
        context: guildId ? 'guild' : 'dm'
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('Failed to list digests', { error });
    await interaction.editReply({ content: '❌ Erro ao listar resumos.' });
  }
}
