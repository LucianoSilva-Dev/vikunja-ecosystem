import type { StringSelectMenuInteraction } from 'discord.js';
import type { SetupService } from '../services/setup.service';
import type { ILogger } from '../../../shared/types';

export interface SetupDmSelectHandlerDeps {
  logger: ILogger;
  setupService: SetupService;
}

/**
 * Handles the DM project selection interaction
 */
export async function handleSetupDmSelect(
  interaction: StringSelectMenuInteraction,
  deps: SetupDmSelectHandlerDeps
): Promise<void> {
  const { setupService, logger } = deps;
  const projectIds = interaction.values.map(Number);
  const userId = interaction.user.id;

  await interaction.deferUpdate();

  const result = await setupService.configureDmNotifications(userId, projectIds);

  if (!result.success) {
    await interaction.editReply({
      content: `❌ ${result.error}`,
      components: [],
    });
    return;
  }

  await interaction.editReply({
    content: `✅ Sucesso! Agora você receberá notificações para **${result.data}** projeto(s) selecionado(s) aqui na sua DM.`,
    components: [],
    embeds: [],
  });

  logger.info('DM Setup completed', {
    userId,
    projectCount: result.data,
  });
}
