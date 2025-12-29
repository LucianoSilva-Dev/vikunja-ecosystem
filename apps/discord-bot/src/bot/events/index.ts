import type { Client } from 'discord.js';
import type { ILogger } from '../../shared/types';
import { registerReadyEvent } from './ready.event';

export interface EventsDeps {
  logger: ILogger;
}

/**
 * Registers all Discord event handlers
 */
export function registerEvents(client: Client, deps: EventsDeps): void {
  registerReadyEvent(client, deps);

  deps.logger.debug('All Discord events registered');
}
