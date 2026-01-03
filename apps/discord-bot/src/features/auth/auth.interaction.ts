import type { ModalSubmitInteraction, CacheType } from 'discord.js';
import type { ILogger } from '../../shared/types';
import type { AuthService } from './auth.service';
import { CONNECT_ACCOUNT_MODAL_ID } from './auth.command';

export class AuthInteractionHandler {
  private readonly logger: ILogger;
  private readonly authService: AuthService;

  constructor(logger: ILogger, authService: AuthService) {
    this.logger = logger;
    this.authService = authService;
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction<CacheType>) {
    if (interaction.customId !== CONNECT_ACCOUNT_MODAL_ID) return;

    await interaction.deferReply({ ephemeral: true });

    const username = interaction.fields.getTextInputValue('username');
    const password = interaction.fields.getTextInputValue('password');

    try {
      const user = await this.authService.connectUser(interaction.user.id, {
        username,
        password,
      });

      await interaction.editReply({
        content: `✅ Conta vinculada com sucesso! Você agora está conectado como **${user.username}** no Vikunja.`,
      });
    } catch (error) {
      this.logger.warn('Failed to link account via modal', {
        userId: interaction.user.id,
        error: error instanceof Error ? error.message : String(error),
      });

      await interaction.editReply({
        content: '❌ Falha ao vincular conta. Verifique suas credenciais e tente novamente.',
      });
    }
  }
}
