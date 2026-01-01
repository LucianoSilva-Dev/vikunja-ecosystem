import {
  SlashCommandBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type Interaction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  StringSelectMenuOptionBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
} from 'discord.js';
import type { CommandHandler, BotServices } from '../types/bot.types';

export const setupCommand: CommandHandler = {
  name: 'setup',
  description: 'Configure o bot Vikunja para receber notificações',
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure o bot Vikunja para receber notificações')
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
      sub
        .setName('dm')
        .setDescription('Configurar para receber notificações na sua DM')
    )
    .addSubcommand((sub) =>
      sub
        .setName('guild')
        .setDescription('Configurar para este servidor')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Canal para receber notificações')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  execute: async (interaction: Interaction, services: BotServices) => {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'dm') {
      await handleSetupDm(interaction, services);
    } else if (subcommand === 'guild') {
      await handleSetupGuild(interaction, services);
    }
  },
};

async function handleSetupDm(
  interaction: ChatInputCommandInteraction,
  services: BotServices
) {
  const { vikunjaApiService, logger } = services;

  await interaction.deferReply({ ephemeral: true });

  try {
    const projects = await vikunjaApiService.listProjects();

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
  } catch (error) {
    logger.error('Error fetching projects', { error });
    await interaction.editReply({
      content: '❌ Erro ao buscar projetos. Verifique a conexão com o Vikunja.',
    });
  }
}

async function handleSetupGuild(
  interaction: ChatInputCommandInteraction,
  services: BotServices
) {
  const channel = interaction.options.getChannel('channel', true);

  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ Este comando só pode ser usado em um servidor.',
      ephemeral: true,
    });
    return;
  }

  // TODO: Implement interactive flow for Guild setup
  // For now, just confirming channel. Next step: Select project for this channel.

  await interaction.reply({
    content: `🔧 Configurando notificações para <#${channel.id}>. Faltam passos de implementação.`,
    ephemeral: true,
  });
}
