import type { Client } from 'discord.js';
import type { InteractionEventDeps } from './interaction.event';
import { registerReadyEvent } from './ready.event';
import { registerInteractionEvent } from './interaction.event';

export interface EventsDeps extends InteractionEventDeps {}

/**
 * Registers all Discord event handlers
 */
export function registerEvents(client: Client, deps: EventsDeps): void {
  registerReadyEvent(client, deps);
  registerInteractionEvent(client, deps);

  deps.logger.debug('All Discord events registered');
}
