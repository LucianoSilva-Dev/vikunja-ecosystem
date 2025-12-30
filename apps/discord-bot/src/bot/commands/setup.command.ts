import {
  SlashCommandBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type Interaction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { CommandHandler } from '../types/bot.types';

export const setupCommand: CommandHandler = {
  name: 'setup',
  description: 'Configure o bot Vikunja para receber notificações',
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure o bot Vikunja para receber notificações')
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

  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'dm') {
      await handleSetupDm(interaction);
    } else if (subcommand === 'guild') {
      await handleSetupGuild(interaction);
    }
  },
};

async function handleSetupDm(interaction: ChatInputCommandInteraction) {
  // TODO: Integrate with VikunjaApiService to list projects
  // For now, show a placeholder message
  const embed = new EmbedBuilder()
    .setTitle('🔧 Configuração de DM')
    .setDescription(
      'Para configurar notificações na sua DM, selecione os projetos Vikunja que deseja acompanhar.'
    )
    .setColor(0x00ae86)
    .addFields({
      name: '📋 Próximos passos',
      value:
        '1. Use `/projects add` para adicionar projetos\n2. As notificações serão enviadas diretamente para você',
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSetupGuild(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true);

  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ Este comando só pode ser usado em um servidor.',
      ephemeral: true,
    });
    return;
  }

  // TODO: Integrate with VikunjaApiService to list projects
  // For now, show a placeholder message
  const embed = new EmbedBuilder()
    .setTitle('🔧 Configuração de Servidor')
    .setDescription(
      `As notificações serão enviadas para o canal <#${channel.id}>.`
    )
    .setColor(0x00ae86)
    .addFields(
      {
        name: '📋 Canal configurado',
        value: `<#${channel.id}>`,
        inline: true,
      },
      {
        name: '📋 Próximos passos',
        value:
          '1. Use `/projects add` para vincular um projeto a este canal\n2. As notificações do projeto aparecerão no canal configurado',
      }
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
