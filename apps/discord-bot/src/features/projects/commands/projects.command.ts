import {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
} from 'discord.js';

/**
 * Projects command definition
 */
export const projectsCommandData = new SlashCommandBuilder()
  .setName('projects')
  .setDescription('Gerenciar projetos Vikunja vinculados')
  .setIntegrationTypes([
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ])
  .setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
  ])
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Listar projetos configurados')
  )
  .addSubcommand((sub) =>
    sub.setName('add').setDescription('Adicionar um novo projeto')
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remover um projeto')
      .addIntegerOption((opt) =>
        opt
          .setName('project_id')
          .setDescription('ID do projeto a remover')
          .setRequired(true)
      )
  );

export const PROJECTS_COMMAND_NAME = 'projects';
