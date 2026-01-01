import { Client, GatewayIntentBits, Partials } from 'discord.js';

export interface DiscordClientConfig {
  intents: GatewayIntentBits[];
  partials: Partials[];
}

/**
 * Default Discord client configuration
 */
export const defaultClientConfig: DiscordClientConfig = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
};

/**
 * Creates the Discord client instance
 */
export function createDiscordClient(
  config: DiscordClientConfig = defaultClientConfig
): Client {
  return new Client({
    intents: config.intents,
    partials: config.partials,
  });
}

export type { Client } from 'discord.js';
