import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Interaction,
  EmbedBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
} from 'discord.js';
import type { CommandHandler, BotServices } from '../types/bot.types';

export const projectsCommand: CommandHandler = {
  name: 'projects',
  description: 'Gerenciar projetos Vikunja vinculados',
  data: new SlashCommandBuilder()
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
    ),

  execute: async (interaction: Interaction, services: BotServices) => {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        await handleListProjects(interaction, services);
        break;
      case 'add':
        await handleAddProject(interaction, services);
        break;
      case 'remove':
        await handleRemoveProject(interaction, services);
        break;
    }
  },
};

async function handleListProjects(
  interaction: ChatInputCommandInteraction,
  services: BotServices
) {
  // TODO: Integrate with ConfigurationRepository
  const isInGuild = !!interaction.guildId;

  const embed = new EmbedBuilder()
    .setTitle('📋 Projetos Configurados')
    .setColor(0x00ae86);

  if (isInGuild) {
    embed.setDescription(
      'Nenhum projeto configurado para este servidor ainda.\nUse `/projects add` para adicionar um projeto.'
    );
  } else {
    embed.setDescription(
      'Nenhum projeto configurado para sua DM ainda.\nUse `/projects add` para adicionar um projeto.'
    );
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAddProject(
  interaction: ChatInputCommandInteraction,
  _services: BotServices
) {
  // TODO: Integrate with VikunjaApiService to list available projects
  // and show a select menu

  const embed = new EmbedBuilder()
    .setTitle('➕ Adicionar Projeto')
    .setDescription(
      'Selecione um projeto Vikunja para adicionar às suas notificações.'
    )
    .setColor(0x00ae86)
    .addFields({
      name: '⚠️ Em desenvolvimento',
      value:
        'Esta funcionalidade será habilitada após a integração com a API Vikunja.',
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRemoveProject(
  interaction: ChatInputCommandInteraction,
  _services: BotServices
) {
  const projectId = interaction.options.getInteger('project_id', true);

  // TODO: Integrate with ConfigurationRepository

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Remover Projeto')
    .setDescription(`Projeto com ID \`${projectId}\` seria removido.`)
    .setColor(0xff6b6b)
    .addFields({
      name: '⚠️ Em desenvolvimento',
      value:
        'Esta funcionalidade será habilitada após a integração com a API Vikunja.',
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
