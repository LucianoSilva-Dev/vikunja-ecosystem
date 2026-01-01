import { Client, GatewayIntentBits, Partials } from 'discord.js';

import type { DiscordClientDeps } from './types/bot.types';
import { registerEvents } from './events';

/**
 * Creates and configures the Discord client
 */
export function createDiscordClient(deps: DiscordClientDeps): Client {
  const { logger } = deps;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.GuildPresences, // Required for bot to show online status
      GatewayIntentBits.GuildMembers, // Required for bot to appear in member list
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  // Register all events
  registerEvents(client, deps);

  logger.debug('Discord client created');

  return client;
}
