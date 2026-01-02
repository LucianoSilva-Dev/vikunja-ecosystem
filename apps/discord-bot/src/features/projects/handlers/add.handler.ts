import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  type GuildTextBasedChannel,
} from 'discord.js';
import type { ProjectsService } from '../services/projects.service';
import type { ILogger } from '../../../shared/types';

export interface AddProjectHandlerDeps {
  logger: ILogger;
  projectsService: ProjectsService;
}

/**
 * Custom IDs for the add project flow
 */
export const ADD_PROJECT_CUSTOM_IDS = {
  PROJECT_SELECT: 'projects_add_project_select',
  CHANNEL_SELECT: 'projects_add_channel_select',
} as const;

/**
 * Handles the /projects add subcommand
 */
export async function handleAddProject(
  interaction: ChatInputCommandInteraction,
  deps: AddProjectHandlerDeps
): Promise<void> {
  const { projectsService, logger } = deps;
  const isInGuild = !!interaction.guildId;

  await interaction.deferReply({ ephemeral: true });

  // Get available projects from Vikunja
  const result = await projectsService.getAvailableProjects();

  if (!result.success) {
    await interaction.editReply({
      content: `❌ ${result.error}`,
    });
    return;
  }

  const projects = result.data!;

  if (projects.length === 0) {
    await interaction.editReply({
      content:
        '❌ Nenhum projeto encontrado no Vikunja. Crie um projeto primeiro.',
    });
    return;
  }

  // Limit to 25 projects for Discord Select Menu limit
  const options = projects.slice(0, 25).map((project) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(project.title || `Project ${project.id}`)
      .setDescription(
        project.description
          ? project.description.substring(0, 50)
          : `Project ID: ${project.id}`
      )
      .setValue(String(project.id))
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId(ADD_PROJECT_CUSTOM_IDS.PROJECT_SELECT)
    .setPlaceholder('Selecione um projeto')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    select
  );

  if (isInGuild) {
    const providedChannel = interaction.options.getChannel('channel') as GuildTextBasedChannel | null;

    const embed = new EmbedBuilder()
      .setTitle('➕ Adicionar Projeto')
      .setDescription(
        providedChannel
          ? `Selecione o projeto Vikunja para vincular ao canal <#${providedChannel.id}>.`
          : 'Selecione o projeto Vikunja que deseja adicionar. Depois você poderá escolher o canal.'
      )
      .setColor(0x00ae86);

    // Store channel in customId if provided
    if (providedChannel) {
      select.setCustomId(`${ADD_PROJECT_CUSTOM_IDS.PROJECT_SELECT}:${providedChannel.id}`);
    }

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    logger.debug('Add project menu displayed', { 
      guildId: interaction.guildId,
      providedChannelId: providedChannel?.id 
    });
  } else {
    // DM flow - same as setup dm
    select.setMaxValues(Math.min(options.length, 25));
    select.setMinValues(1);

    const embed = new EmbedBuilder()
      .setTitle('➕ Adicionar Projeto')
      .setDescription(
        'Selecione os projetos Vikunja que você deseja receber notificações na sua DM.'
      )
      .setColor(0x00ae86);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    logger.debug('Add project menu displayed (DM)', { userId: interaction.user.id });
  }
}

/**
 * Handles the project select menu interaction for add flow
 */
export async function handleAddProjectSelect(
  interaction: import('discord.js').StringSelectMenuInteraction,
  deps: AddProjectHandlerDeps
): Promise<void> {
  const { projectsService, logger } = deps;
  const selectedIds = interaction.values;
  const isInGuild = !!interaction.guildId;

  await interaction.deferUpdate();

  if (isInGuild) {
    // Guild flow - check if channel was provided in customId
    const [customIdBase, channelId] = interaction.customId.split(':');
    const projectId = parseInt(selectedIds[0], 10);

    if (channelId) {
      // Channel was provided, add project directly
      const result = await projectsService.addProjectToChannel(
        interaction.guildId!,
        channelId,
        projectId
      );

      if (!result.success) {
        await interaction.editReply({
          content: `❌ ${result.error}`,
          embeds: [],
          components: [],
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Projeto Adicionado')
        .setDescription(`Projeto vinculado ao canal <#${channelId}> com sucesso!`)
        .setColor(0x00ae86);

      await interaction.editReply({
        embeds: [embed],
        components: [],
      });

      logger.info('Project added to channel via provided option', {
        guildId: interaction.guildId,
        channelId,
        projectId,
      });
    } else {
      // Need to select channel
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`${ADD_PROJECT_CUSTOM_IDS.CHANNEL_SELECT}:${projectId}`)
        .setPlaceholder('Selecione o canal')
        .setChannelTypes(ChannelType.GuildText);

      const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        channelSelect
      );

      const embed = new EmbedBuilder()
        .setTitle('➕ Selecione o Canal')
        .setDescription(`Agora selecione o canal onde deseja vincular o projeto.`)
        .setColor(0x00ae86);

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      logger.debug('Channel select menu displayed', {
        guildId: interaction.guildId,
        projectId,
      });
    }
  } else {
    // DM flow - add all selected projects
    const results: { projectId: number; success: boolean; error?: string }[] = [];

    for (const projectIdStr of selectedIds) {
      const projectId = parseInt(projectIdStr, 10);
      const result = await projectsService.addProjectToDm(
        interaction.user.id,
        projectId
      );
      results.push({ projectId, success: result.success, error: result.error });
    }

    const successfulProjects = results.filter((r) => r.success);
    const failedProjects = results.filter((r) => !r.success);

    let description = '';

    if (successfulProjects.length > 0) {
      description += `✅ ${successfulProjects.length} projeto(s) adicionado(s) com sucesso!\n`;
    }

    if (failedProjects.length > 0) {
      description += `❌ ${failedProjects.length} projeto(s) falharam ao adicionar.`;
    }

    const embed = new EmbedBuilder()
      .setTitle('➕ Projetos Adicionados')
      .setDescription(description)
      .setColor(failedProjects.length > 0 ? 0xff6b6b : 0x00ae86);

    await interaction.editReply({
      embeds: [embed],
      components: [],
    });

    logger.info('Projects added to DM', {
      userId: interaction.user.id,
      successCount: successfulProjects.length,
      failedCount: failedProjects.length,
    });
  }
}

/**
 * Handles the channel select menu interaction for add flow
 */
export async function handleAddChannelSelect(
  interaction: import('discord.js').ChannelSelectMenuInteraction,
  deps: AddProjectHandlerDeps
): Promise<void> {
  const { projectsService, logger } = deps;
  
  await interaction.deferUpdate();

  const [, projectIdStr] = interaction.customId.split(':');
  const projectId = parseInt(projectIdStr, 10);
  const channelId = interaction.values[0];

  const result = await projectsService.addProjectToChannel(
    interaction.guildId!,
    channelId,
    projectId
  );

  if (!result.success) {
    await interaction.editReply({
      content: `❌ ${result.error}`,
      embeds: [],
      components: [],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Projeto Adicionado')
    .setDescription(`Projeto vinculado ao canal <#${channelId}> com sucesso!`)
    .setColor(0x00ae86);

  await interaction.editReply({
    embeds: [embed],
    components: [],
  });

  logger.info('Project added to channel via channel select', {
    guildId: interaction.guildId,
    channelId,
    projectId,
  });
}
