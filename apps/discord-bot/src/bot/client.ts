import { Client, GatewayIntentBits, Partials } from 'discord.js';
import type { ILogger } from '../shared/types';
import { registerEvents } from './events';

export interface DiscordClientDeps {
  logger: ILogger;
}

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
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  // Register all events
  registerEvents(client, { logger });

  logger.debug('Discord client created');

  return client;
}
