import type { Client, Interaction } from 'discord.js';
import type { BotServices } from '../../bot/types/bot.types';
import { getCommand } from '../commands';
import { handleSetupDmSelect } from '../handlers/setup-dm.handler';

export interface InteractionEventDeps extends BotServices {}

/**
 * Registers the interactionCreate event handler
 */
export function registerInteractionEvent(
  client: Client,
  deps: InteractionEventDeps
): void {
  const { logger } = deps;

  client.on('interactionCreate', async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = getCommand(interaction.commandName);

        if (!command) {
          logger.warn('Unknown command', {
            commandName: interaction.commandName,
          });
          return;
        }

        logger.debug('Executing command', {
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });

        await command.execute(interaction, deps);
      } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'setup_dm_project_select') {
          await handleSetupDmSelect(interaction, deps);
        }
      }
    } catch (error) {
      logger.error('Interaction failed', {
        type: interaction.type,
        id: interaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      const errorMessage = '❌ Ocorreu um erro ao processar sua solicitação.';

      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true,
          });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    }
  });

  logger.debug('Interaction event registered');
}
