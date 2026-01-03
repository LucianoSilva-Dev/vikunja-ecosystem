import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type CacheType,
} from 'discord.js';
import type { ILogger } from '../../shared/types';
import type { AuthService } from './auth.service';

export const CONNECT_ACCOUNT_COMMAND_NAME = 'connect-account';
export const CONNECT_ACCOUNT_MODAL_ID = 'connect-account-modal';
export const DISCONNECT_ACCOUNT_COMMAND_NAME = 'disconnect-account';

export class AuthCommand {
  private readonly logger: ILogger;
  private readonly authService: AuthService;

  constructor(logger: ILogger, authService: AuthService) {
    this.logger = logger;
    this.authService = authService;
  }

  get definitions() {
    return [
      new SlashCommandBuilder()
        .setName(CONNECT_ACCOUNT_COMMAND_NAME)
        .setDescription('Vincula sua conta Discord à sua conta Vikunja'),
      new SlashCommandBuilder()
        .setName(DISCONNECT_ACCOUNT_COMMAND_NAME)
        .setDescription('Desvincula sua conta Vikunja atual'),
    ];
  }

  async handle(interaction: ChatInputCommandInteraction<CacheType>) {
    const commandName = interaction.commandName;
    this.logger.debug(`Handling auth command: ${commandName}`, {
      userId: interaction.user.id,
    });

    if (commandName === CONNECT_ACCOUNT_COMMAND_NAME) {
      await this.handleConnect(interaction);
    } else if (commandName === DISCONNECT_ACCOUNT_COMMAND_NAME) {
      await this.handleDisconnect(interaction);
    }
  }

  private async handleConnect(
    interaction: ChatInputCommandInteraction<CacheType>
  ) {
    const isConnected = await this.authService.isUserConnected(interaction.user.id);
    if (isConnected) {
      await interaction.reply({
        content:
          '✅ Você já possui uma conta Vikunja vinculada! Use `/disconnect-account` se desejar remover o vínculo atual.',
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(CONNECT_ACCOUNT_MODAL_ID)
      .setTitle('Vincular Conta Vikunja');

    const usernameInput = new TextInputBuilder()
      .setCustomId('username')
      .setLabel('Usuário ou Email do Vikunja')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const passwordInput = new TextInputBuilder()
      .setCustomId('password')
      .setLabel('Senha')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      usernameInput
    );
    const secondActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(passwordInput);

    modal.addComponents(firstActionRow, secondActionRow);

    await interaction.showModal(modal);
  }

  private async handleDisconnect(
    interaction: ChatInputCommandInteraction<CacheType>
  ) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const removed = await this.authService.disconnectUser(interaction.user.id);

      if (removed) {
        await interaction.editReply({
          content: '✅ Conta desvinculada com sucesso.',
        });
      } else {
        await interaction.editReply({
          content: 'ℹ️ Nenhuma conta vinculada encontrada para este usuário.',
        });
      }
    } catch (error) {
      this.logger.error('Failed to disconnect user', {
        userId: interaction.user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await interaction.editReply({
        content: '❌ Falha ao desvincular conta.',
      });
    }
  }
}
