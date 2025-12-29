import type { Client, Interaction } from 'discord.js';

export interface CommandHandler {
  name: string;
  description: string;
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
