import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { ProjectsService } from '../services/projects.service';
import type { ILogger } from '../../../shared/types';

export interface ListProjectsHandlerDeps {
  logger: ILogger;
  projectsService: ProjectsService;
}

/**
 * Handles the /projects list subcommand
 */
export async function handleListProjects(
  interaction: ChatInputCommandInteraction,
  deps: ListProjectsHandlerDeps
): Promise<void> {
  const { projectsService } = deps;
  const isInGuild = !!interaction.guildId;
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle('📋 Projetos Configurados')
    .setColor(0x00ae86);

  if (isInGuild) {
    const projects = await projectsService.listGuildProjects(interaction.guildId!);

    if (projects.length === 0) {
      embed.setDescription(
        'Nenhum projeto configurado para este servidor ainda.\nUse `/projects add` para configurar um canal.'
      );
    } else {
      const projectList = projects
        .map((p) => `• **${p.projectName}** (ID: ${p.projectId}) - <#${p.channelId}>`)
        .join('\n');
      embed.setDescription(projectList);
    }
  } else {
    const projects = await projectsService.listDmProjects(userId);

    if (projects.length === 0) {
      embed.setDescription(
        'Nenhum projeto configurado para sua DM ainda.\nUse `/setup dm` para adicionar projetos.'
      );
    } else {
      const projectList = projects
        .map((p) => `• **${p.projectName}** (ID: ${p.projectId})`)
        .join('\n');
      embed.setDescription(projectList);
    }
  }

  await interaction.editReply({ embeds: [embed] });
}
