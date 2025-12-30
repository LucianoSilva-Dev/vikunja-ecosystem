import type { Client, Interaction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface CommandHandler {
  name: string;
  description: string;
  data?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: Interaction) => Promise<void>;
}

export interface BotEventHandler {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void> | void;
}

export interface DiscordClientDeps {
  // Will be expanded with services later
}
