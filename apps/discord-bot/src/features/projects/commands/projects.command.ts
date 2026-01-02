import {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChannelType,
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
    sub
      .setName('add')
      .setDescription('Adicionar um novo projeto')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Canal para associar ao projeto (apenas em servidores)')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('remove').setDescription('Remover um projeto')
  );

export const PROJECTS_COMMAND_NAME = 'projects';
