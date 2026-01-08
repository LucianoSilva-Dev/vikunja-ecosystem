/**
 * /task Command Definition
 *
 * Starts an interactive flow to manage tasks:
 * 1. Select project
 * 2. Select task
 * 3. Select action
 */

import { SlashCommandBuilder } from 'discord.js';

export const TASK_COMMAND_NAME = 'task';

export const taskCommandData = new SlashCommandBuilder()
  .setName(TASK_COMMAND_NAME)
  .setDescription('Gerenciar tasks do Vikunja')
  .setDMPermission(true);
