import type { StringSelectMenuInteraction } from 'discord.js';
import type { BotServices } from '../types/bot.types';

export async function handleSetupDmSelect(
  interaction: StringSelectMenuInteraction,
  services: BotServices
) {
  const { configRepository, logger } = services;
  const projectIds = interaction.values;
  const userId = interaction.user.id;
  const username = interaction.user.username;

  await interaction.deferUpdate();

  try {
    // Bind projects
    for (const projectId of projectIds) {
      const id = Number(projectId);
      const project = await services.vikunjaApiService.getProject(id);

      if (project) {
        await configRepository.addProjectToDm(userId, {
          projectId: id,
          projectName: project.title || `Project ${id}`,
          webhookEvents: [], // Default to no specific event filtering (all enabled by default maybe? or requires update)
        });
      }
    }

    await interaction.editReply({
      content: `✅ Sucesso! Agora você receberá notificações para **${projectIds.length}** projeto(s) selecionado(s) aqui na sua DM.`,
      components: [], // Remove the select menu
      embeds: [], // Remove the embed or keep it, up to preference. Clearing is cleaner.
    });

    logger.info('DM Setup completed', { userId, projectCount: projectIds.length });
  } catch (error) {
    logger.error('Failed to save DM configuration', { error });
    await interaction.editReply({
      content: '❌ Ocorreu um erro ao salvar suas preferências. Tente novamente.',
      components: [],
    });
  }
}
