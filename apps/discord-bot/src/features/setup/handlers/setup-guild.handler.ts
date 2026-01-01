import type { ChatInputCommandInteraction } from 'discord.js';
import type { ILogger } from '../../../shared/types';

export interface SetupGuildHandlerDeps {
  logger: ILogger;
}

/**
 * Handles the /setup guild subcommand
 */
export async function handleSetupGuild(
  interaction: ChatInputCommandInteraction,
  deps: SetupGuildHandlerDeps
): Promise<void> {
  const channel = interaction.options.getChannel('channel', true);

  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ Este comando só pode ser usado em um servidor.',
      ephemeral: true,
    });
    return;
  }

  // TODO: Implement interactive flow for Guild setup
  // For now, just confirming channel. Next step: Select project for this channel.

  await interaction.reply({
    content: `🔧 Configurando notificações para <#${channel.id}>. Faltam passos de implementação.`,
    ephemeral: true,
  });
}
