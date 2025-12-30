import type { Client, Interaction } from 'discord.js';
import type { ILogger } from '../../shared/types';
import { getCommand } from '../commands';

export interface InteractionEventDeps {
  logger: ILogger;
}

/**
 * Registers the interactionCreate event handler
 */
export function registerInteractionEvent(
  client: Client,
  deps: InteractionEventDeps
): void {
  const { logger } = deps;

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = getCommand(interaction.commandName);

    if (!command) {
      logger.warn('Unknown command', { commandName: interaction.commandName });
      return;
    }

    try {
      logger.debug('Executing command', {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });

      await command.execute(interaction);
    } catch (error) {
      logger.error('Command execution failed', {
        commandName: interaction.commandName,
        error: error instanceof Error ? error.message : String(error),
      });

      const errorMessage = '❌ Ocorreu um erro ao executar este comando.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  });

  logger.debug('Interaction event registered');
}
