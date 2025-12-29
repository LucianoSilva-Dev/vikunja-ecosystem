import type { Client } from 'discord.js';
import type { ILogger } from '../../shared/types';

export interface ReadyEventDeps {
  logger: ILogger;
}

/**
 * Registers the ready event handler
 */
export function registerReadyEvent(
  client: Client,
  deps: ReadyEventDeps
): void {
  const { logger } = deps;

  client.once('ready', (readyClient) => {
    logger.info('Discord bot is ready!', {
      username: readyClient.user.tag,
      guilds: readyClient.guilds.cache.size,
    });
  });
}
