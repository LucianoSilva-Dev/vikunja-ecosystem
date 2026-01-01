import {
  SlashCommandBuilder,
  type Interaction,
  ApplicationIntegrationType,
  InteractionContextType,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandHandler, BotServices } from '../types/bot.types';

/**
 * Ping command - responds with "Pong!"
 */
export const pingCommand: CommandHandler = {
  name: 'ping',
  description: 'Responds with Pong!',
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Responds with Pong!')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),
  execute: async (interaction, _services: BotServices) => {
    if (!interaction.isChatInputCommand()) return;

    const chatInteraction = interaction as ChatInputCommandInteraction;
    await chatInteraction.reply('Pong! 🏓');
  },
};
