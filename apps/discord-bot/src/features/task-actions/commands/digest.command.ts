/**
 * /digest Command Definition
 *
 * Manage daily/weekly summaries of tasks
 */

import { SlashCommandBuilder } from 'discord.js';

export const DIGEST_COMMAND_NAME = 'digest';

export const digestCommandData = new SlashCommandBuilder()
  .setName(DIGEST_COMMAND_NAME)
  .setDescription('Gerenciar resumos (digests) de tarefas')
  .setDMPermission(true)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Configurar um novo resumo automático')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('Listar resumos configurados')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('remove')
      .setDescription('Remover um resumo existente')
  );

export const DIGEST_CUSTOM_IDS = {
  PROJECT_SELECT: 'digest_project_select',
  PRIORITY_SELECT: 'digest_priority_select',
  FREQUENCY_SELECT: 'digest_frequency_select',
  REMOVE_SELECT: 'digest_remove_select',
  CONFIRM_REMOVE: 'digest_confirm_remove',
};
