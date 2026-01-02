import {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
} from 'discord.js';

/**
 * Setup command definition
 * Only contains structure - handlers are separate
 */
export const setupCommandData = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configure o bot Vikunja para receber notificações')
  .setIntegrationTypes([
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ])
  .setContexts([
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
  ])
  .addSubcommand((sub) =>
    sub
      .setName('dm')
      .setDescription('Configurar para receber notificações na sua DM')
  );

export const SETUP_COMMAND_NAME = 'setup';
