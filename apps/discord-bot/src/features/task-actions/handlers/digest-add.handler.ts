import {
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  StringSelectMenuInteraction,
  ChannelSelectMenuBuilder,
  ChannelType,
} from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';
import type { UserMappingRepository } from '../../../shared/repositories/user-mapping.repository';
import { DIGEST_CUSTOM_IDS } from '../commands/digest.command';
import { showDigestPrioritySelect } from './digest-priority-select.handler';

interface DigestAddDeps {
  logger: ILogger;
  vikunjaApiService: VikunjaApiService;
  userMappingRepository: UserMappingRepository;
}

export async function handleDigestAdd(
  interaction: ChatInputCommandInteraction,
  deps: DigestAddDeps
): Promise<void> {
  const { logger, userMappingRepository, vikunjaApiService } = deps;
  const discordUserId = interaction.user.id;

  logger.info('Handling digest add command', { userId: discordUserId });

  await interaction.deferReply({ ephemeral: true });

  // 1. Check if user is connected
  const vikunjaUserId = await userMappingRepository.findVikunjaUserId(discordUserId);
  if (!vikunjaUserId) {
    await interaction.editReply({
      content:
        '❌ Você precisa conectar sua conta Vikunja primeiro.\nUse `/connect-account` para configurar.',
    });
    return;
  }

  // 2. Fetch projects
  try {
    const projects = await vikunjaApiService.listProjects();

    if (!projects || projects.length === 0) {
      await interaction.editReply({
        content: '❌ Nenhum projeto encontrado na sua conta Vikunja.',
      });
      return;
    }

    // 3. Show Project Select Menu
    const select = new StringSelectMenuBuilder()
      .setCustomId(DIGEST_CUSTOM_IDS.PROJECT_SELECT)
      .setPlaceholder('Selecione um projeto para o resumo')
      .addOptions(
        projects
          .filter(p => p.id && p.title)
          .slice(0, 25)
          .map((p) => ({
            label: p.title || 'Projeto sem título',
            value: (p.id || 0).toString(),
            description: p.description ? p.description.slice(0, 100) : undefined,
          }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.editReply({
      content: '📂 Selecione o projeto para configurar o resumo automático:',
      components: [row],
    });
  } catch (error) {
    logger.error('Failed to fetch projects', {
      userId: discordUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply({
      content: '❌ Erro ao buscar projetos. Verifique sua conexão ou tente novamente.',
    });
  }
}

export async function handleDigestProjectSelect(
    interaction: StringSelectMenuInteraction,
    deps: DigestAddDeps
): Promise<void> {
    const { logger } = deps;
    const projectId = parseInt(interaction.values[0], 10);
    
    logger.info('Project selected for digest', { projectId, guildId: interaction.guildId });

    if (interaction.guildId) {
        // Guild Context: Ask for Channel
        const row = new ActionRowBuilder<ChannelSelectMenuBuilder>()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId(`digest_channel_select_${projectId}`)
                    .setPlaceholder('Selecione o canal para enviar o resumo')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            );
            
        await interaction.update({
            content: '📢 Selecione o canal onde o resumo será enviado:',
            components: [row]
        });
    } else {
        // DM Context: Proceed to Frequency Selection directly
        // Pass channelId as undefined/null
        await showDigestPrioritySelect(interaction, projectId, 'dm');
    }
}

export async function handleDigestChannelSelect(
    interaction: any, // ChannelSelectMenuInteraction
    deps: DigestAddDeps
): Promise<void> {
   const { logger } = deps;
   // customId: digest_channel_select_{projectId}
   const projectId = parseInt(interaction.customId.split('_').pop());
   const channelId = interaction.values[0];

   logger.info('Channel selected for digest', { channelId, projectId });

   // Proceed to Frequency Selection
   // Since this is channel select, interaction update is expected
   await showDigestPrioritySelect(interaction, projectId, 'guild', channelId);
}
