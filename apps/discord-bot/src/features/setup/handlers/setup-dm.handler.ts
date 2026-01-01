import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { SetupService } from '../services/setup.service';
import type { ILogger } from '../../../shared/types';

export interface SetupDmHandlerDeps {
  logger: ILogger;
  setupService: SetupService;
}

/**
 * Handles the /setup dm subcommand
 */
export async function handleSetupDm(
  interaction: ChatInputCommandInteraction,
  deps: SetupDmHandlerDeps
): Promise<void> {
  const { setupService, logger } = deps;

  await interaction.deferReply({ ephemeral: true });

  const result = await setupService.getAvailableProjects();

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
        '❌ Nenhum projeto encontrado na sua conta Vikunja. Crie um projeto primeiro.',
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
    .setCustomId('setup_dm_project_select')
    .setPlaceholder('Selecione os projetos para monitorar')
    .addOptions(options)
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 25));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    select
  );

  const embed = new EmbedBuilder()
    .setTitle('🔧 Configuração de DM')
    .setDescription(
      'Selecione abaixo os projetos Vikunja que você deseja receber notificações na sua DM.'
    )
    .setColor(0x00ae86);

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });

  logger.debug('Setup DM menu displayed', { userId: interaction.user.id });
}
