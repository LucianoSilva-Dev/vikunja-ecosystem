import { type Client, Events, ActivityType } from 'discord.js';
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

  client.once(Events.ClientReady, (readyClient) => {
    logger.info('Discord bot is ready!', {
      username: readyClient.user.tag,
      guilds: readyClient.guilds.cache.size,
    });

    readyClient.user.setPresence({
      status: 'online',
      activities: [
        {
          name: 'Vikunja Projects',
          type: ActivityType.Watching,
        },
      ],
    });
  });
}
