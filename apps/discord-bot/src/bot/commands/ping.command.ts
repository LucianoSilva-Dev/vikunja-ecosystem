import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandHandler } from '../types/bot.types';

/**
 * Ping command - responds with "Pong!"
 */
export const pingCommand: CommandHandler = {
  name: 'ping',
  description: 'Replies with Pong!',
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const chatInteraction = interaction as ChatInputCommandInteraction;
    await chatInteraction.reply('Pong! 🏓');
  },
};
