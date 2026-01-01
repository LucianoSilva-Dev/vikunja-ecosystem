import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { ProjectsService } from '../services/projects.service';
import type { ILogger } from '../../../shared/types';

export interface RemoveProjectHandlerDeps {
  logger: ILogger;
  projectsService: ProjectsService;
}

/**
 * Handles the /projects remove subcommand
 */
export async function handleRemoveProject(
  interaction: ChatInputCommandInteraction,
  deps: RemoveProjectHandlerDeps
): Promise<void> {
  const { projectsService, logger } = deps;
  const projectId = interaction.options.getInteger('project_id', true);
  const userId = interaction.user.id;
  const isInGuild = !!interaction.guildId;

  await interaction.deferReply({ ephemeral: true });

  if (isInGuild) {
    // TODO: Implement guild project removal
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Remover Projeto')
      .setDescription('Remoção de projetos de servidores ainda não implementada.')
      .setColor(0xff6b6b);

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const result = await projectsService.removeProjectFromDm(userId, projectId);

  if (!result.success) {
    await interaction.editReply({
      content: `❌ ${result.error}`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Projeto Removido')
    .setDescription(`Projeto com ID \`${projectId}\` foi removido das suas notificações.`)
    .setColor(0x00ae86);

  await interaction.editReply({ embeds: [embed] });
  logger.info('Project removed from DM', { userId, projectId });
}
