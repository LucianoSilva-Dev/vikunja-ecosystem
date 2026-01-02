import type { ChatInputCommandInteraction } from 'discord.js';
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
} from 'discord.js';
import type { ProjectsService } from '../services/projects.service';
import type { ILogger } from '../../../shared/types';

export interface RemoveProjectHandlerDeps {
  logger: ILogger;
  projectsService: ProjectsService;
}

/**
 * Custom IDs for the remove project flow
 */
export const REMOVE_PROJECT_CUSTOM_IDS = {
  CHANNEL_SELECT: 'projects_remove_channel_select',
  PROJECT_SELECT: 'projects_remove_project_select',
} as const;

/**
 * Handles the /projects remove subcommand
 */
export async function handleRemoveProject(
  interaction: ChatInputCommandInteraction,
  deps: RemoveProjectHandlerDeps
): Promise<void> {
  const { projectsService, logger } = deps;
  const isInGuild = !!interaction.guildId;

  await interaction.deferReply({ ephemeral: true });

  if (isInGuild) {
    // Guild flow - show select menu with configured channels
    const configuredChannels = await projectsService.listGuildProjects(interaction.guildId!);

    if (configuredChannels.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Nenhum projeto configurado')
        .setDescription(
          'Não há projetos configurados neste servidor.\n\n' +
          'Use `/projects add` para adicionar um projeto a um canal.'
        )
        .setColor(0xff6b6b);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Resolve channel names using Discord API
    const guild = interaction.guild;
    const channelNamesCount = new Map<string, number>();

    // First pass: count duplicate channel names
    for (const binding of configuredChannels) {
      const channel = guild?.channels.cache.get(binding.channelId);
      const channelName = channel?.name || 'canal-desconhecido';
      channelNamesCount.set(channelName, (channelNamesCount.get(channelName) || 0) + 1);
    }

    // Build select menu with resolved channel names
    const options = configuredChannels.slice(0, 25).map((binding) => {
      const channel = guild?.channels.cache.get(binding.channelId);
      const channelName = channel?.name || 'canal-desconhecido';
      const parentName = channel?.parent?.name;
      
      // Add category as discriminator if there are duplicate channel names
      const hasDuplicateName = (channelNamesCount.get(channelName) || 0) > 1;
      const displayName = hasDuplicateName && parentName 
        ? `#${channelName} (${parentName})`
        : `#${channelName}`;

      return new StringSelectMenuOptionBuilder()
        .setLabel(binding.projectName)
        .setDescription(displayName)
        .setValue(binding.channelId);
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId(REMOVE_PROJECT_CUSTOM_IDS.CHANNEL_SELECT)
      .setPlaceholder('Selecione os projetos para remover')
      .addOptions(options)
      .setMinValues(1)
      .setMaxValues(Math.min(options.length, 25));

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Remover Projeto')
      .setDescription('Selecione os projetos que deseja remover:')
      .setColor(0xff6b6b);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    logger.debug('Remove project menu displayed (guild)', { guildId: interaction.guildId });
  } else {
    // DM flow - show select menu with configured projects
    const configuredProjects = await projectsService.listDmProjects(interaction.user.id);

    if (configuredProjects.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Nenhum projeto configurado')
        .setDescription(
          'Você não tem nenhum projeto configurado para notificações.\n\n' +
          'Use `/projects add` para adicionar projetos.'
        )
        .setColor(0xff6b6b);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Build select menu with configured projects
    const options = configuredProjects.slice(0, 25).map((project) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(project.projectName)
        .setDescription(`ID: ${project.projectId}`)
        .setValue(String(project.projectId))
    );

    const select = new StringSelectMenuBuilder()
      .setCustomId(REMOVE_PROJECT_CUSTOM_IDS.PROJECT_SELECT)
      .setPlaceholder('Selecione o projeto para remover')
      .addOptions(options)
      .setMinValues(1)
      .setMaxValues(Math.min(options.length, 25));

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Remover Projeto')
      .setDescription('Selecione os projetos que deseja remover das suas notificações:')
      .setColor(0xff6b6b);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    logger.debug('Remove project menu displayed (DM)', { userId: interaction.user.id });
  }
}

/**
 * Handles the channel select menu interaction for remove flow (guild)
 */
export async function handleRemoveChannelSelect(
  interaction: import('discord.js').StringSelectMenuInteraction,
  deps: RemoveProjectHandlerDeps
): Promise<void> {
  const { projectsService, logger } = deps;

  await interaction.deferUpdate();

  const channelIds = interaction.values;
  const results: { channelId: string; projectName: string; success: boolean; error?: string }[] = [];

  for (const channelId of channelIds) {
    // Get project info before removing
    const projectResult = await projectsService.getProjectByChannel(
      interaction.guildId!,
      channelId
    );

    const result = await projectsService.removeProjectFromChannel(
      interaction.guildId!,
      channelId
    );

    results.push({
      channelId,
      projectName: projectResult.data?.projectName || 'Projeto',
      success: result.success,
      error: result.error,
    });
  }

  const successfulRemovals = results.filter((r) => r.success);
  const failedRemovals = results.filter((r) => !r.success);

  let description = '';

  if (successfulRemovals.length > 0) {
    description += `✅ ${successfulRemovals.length} projeto(s) removido(s) com sucesso!\n`;
  }

  if (failedRemovals.length > 0) {
    description += `❌ ${failedRemovals.length} projeto(s) falharam ao remover.`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Projetos Removidos')
    .setDescription(description)
    .setColor(failedRemovals.length > 0 ? 0xff6b6b : 0x00ae86);

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });

  logger.info('Projects removed from channel via select', {
    guildId: interaction.guildId,
    successCount: successfulRemovals.length,
    failedCount: failedRemovals.length,
  });
}

/**
 * Handles the project select menu interaction for remove flow (DM)
 */
export async function handleRemoveProjectSelect(
  interaction: import('discord.js').StringSelectMenuInteraction,
  deps: RemoveProjectHandlerDeps
): Promise<void> {
  const { projectsService, logger } = deps;

  await interaction.deferUpdate();

  const userId = interaction.user.id;
  const projectIds = interaction.values.map((id) => parseInt(id, 10));

  const results: { projectId: number; success: boolean; error?: string }[] = [];

  for (const projectId of projectIds) {
    const result = await projectsService.removeProjectFromDm(userId, projectId);
    results.push({ projectId, success: result.success, error: result.error });
  }

  const successfulProjects = results.filter((r) => r.success);
  const failedProjects = results.filter((r) => !r.success);

  let description = '';

  if (successfulProjects.length > 0) {
    description += `✅ ${successfulProjects.length} projeto(s) removido(s) com sucesso!\n`;
  }

  if (failedProjects.length > 0) {
    description += `❌ ${failedProjects.length} projeto(s) falharam ao remover.`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Projetos Removidos')
    .setDescription(description)
    .setColor(failedProjects.length > 0 ? 0xff6b6b : 0x00ae86);

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });

  logger.info('Projects removed from DM via select', {
    userId,
    successCount: successfulProjects.length,
    failedCount: failedProjects.length,
  });
}
