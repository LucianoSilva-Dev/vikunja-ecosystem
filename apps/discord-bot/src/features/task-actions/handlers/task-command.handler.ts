/**
 * Task Command Handlers
 *
 * Handles the interactive flow for /task command:
 * 1. Project selection
 * 2. Task selection
 * 3. Action selection
 */

import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { ILogger } from '../../../shared/types';
import type { ConfigurationRepository } from '../../../shared/repositories/configuration.repository';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';
import type { ReminderRepository } from '../repositories/reminder.repository';

export const TASK_COMMAND_CUSTOM_IDS = {
  PROJECT_SELECT: 'task_cmd_project_select',
  TASK_SELECT: 'task_cmd_task_select',
  ACTION_SELECT: 'task_cmd_action_select',
} as const;

export interface TaskCommandHandlerDeps {
  logger: ILogger;
  configRepository: ConfigurationRepository;
  vikunjaApiService: VikunjaApiService;
  reminderRepository: ReminderRepository;
}

/**
 * Handle initial /task command - show project selection
 */
export async function handleTaskCommand(
  interaction: ChatInputCommandInteraction,
  deps: TaskCommandHandlerDeps
): Promise<void> {
  const { logger, configRepository, vikunjaApiService } = deps;

  logger.debug('Handling /task command', {
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get projects based on context (guild or DM)
    let projects: Array<{ id: number; name: string }> = [];

    if (interaction.guildId) {
      // Guild context - get projects from guild bindings
      const bindings = await configRepository.listGuildChannels(
        interaction.guildId
      );
      if (bindings && bindings.length > 0) {
        // Deduplicate projects
        const seen = new Set<number>();
        for (const binding of bindings) {
          if (!seen.has(binding.projectId)) {
            seen.add(binding.projectId);
            projects.push({ id: binding.projectId, name: binding.projectName });
          }
        }
      }
    } else {
      // DM context - get projects from DM bindings
      const bindings = await configRepository.listDmProjects(
        interaction.user.id
      );
      if (bindings && bindings.length > 0) {
        projects = bindings.map((b) => ({
          id: b.projectId,
          name: b.projectName,
        }));
      }
    }

    if (projects.length === 0) {
      await interaction.editReply({
        content:
          '❌ Nenhum projeto configurado.\n' +
          '💡 Use `/projects add` para adicionar projetos.',
      });
      return;
    }

    // Build project select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(TASK_COMMAND_CUSTOM_IDS.PROJECT_SELECT)
      .setPlaceholder('Selecione um projeto')
      .addOptions(
        projects.slice(0, 25).map((p) => ({
          label: p.name,
          value: String(p.id),
          description: `ID: ${p.id}`,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    await interaction.editReply({
      content: '📁 Selecione um projeto para gerenciar tasks:',
      components: [row],
    });
  } catch (error) {
    logger.error('Failed to handle /task command', {
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply({
      content: '❌ Erro ao carregar projetos.',
    });
  }
}

/**
 * Handle project selection - show task list
 */
export async function handleTaskProjectSelect(
  interaction: StringSelectMenuInteraction,
  deps: TaskCommandHandlerDeps
): Promise<void> {
  const { logger, vikunjaApiService } = deps;
  const projectId = parseInt(interaction.values[0], 10);

  logger.debug('Task command: project selected', { projectId });

  await interaction.deferUpdate();

  try {
    // Fetch tasks for project
    const tasks = await vikunjaApiService.getProjectTasks(projectId);

    // Filter out completed tasks for better UX
    const activeTasks = tasks.filter((t) => !t.done);

    if (activeTasks.length === 0) {
      await interaction.editReply({
        content: '✅ Não há tasks ativas neste projeto!',
        components: [],
      });
      return;
    }

    // Build task select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`${TASK_COMMAND_CUSTOM_IDS.TASK_SELECT}:${projectId}`)
      .setPlaceholder('Selecione uma task')
      .addOptions(
        activeTasks.slice(0, 25).map((t) => {
          const dueInfo = t.due_date
            ? ` | ⏰ ${new Date(t.due_date).toLocaleDateString('pt-BR')}`
            : '';
          return {
            label: (t.title ?? 'Sem título').slice(0, 100),
            value: String(t.id),
            description: `#${t.id}${dueInfo}`.slice(0, 100),
          };
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    await interaction.editReply({
      content: `📋 Selecione uma task (${activeTasks.length} ativas):`,
      components: [row],
    });
  } catch (error) {
    logger.error('Failed to fetch tasks for project', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply({
      content: '❌ Erro ao carregar tasks.',
      components: [],
    });
  }
}

/**
 * Handle task selection - show action menu
 */
export async function handleTaskTaskSelect(
  interaction: StringSelectMenuInteraction,
  deps: TaskCommandHandlerDeps
): Promise<void> {
  const { logger, vikunjaApiService, reminderRepository } = deps;

  // Extract projectId from customId
  const customIdParts = interaction.customId.split(':');
  const projectId = parseInt(customIdParts[1], 10);
  const taskId = parseInt(interaction.values[0], 10);

  logger.debug('Task command: task selected', { projectId, taskId });

  await interaction.deferUpdate();

  try {
    // Fetch task details
    const task = await vikunjaApiService.getTaskById(taskId);

    if (!task) {
      await interaction.editReply({
        content: '❌ Task não encontrada.',
        components: [],
      });
      return;
    }

    // Build options list
    const options = [
      {
        label: task.done ? 'Reabrir' : 'Marcar como Concluída',
        value: task.done ? 'reopen' : 'mark_complete',
        emoji: task.done ? '🔄' : '✅',
      },
      {
        label: 'Atribuir a Mim',
        value: 'assign_me',
        emoji: '👤',
      },
      {
        label: 'Definir Due Date',
        value: 'due_date',
        emoji: '📅',
      },
      {
        label: 'Criar Lembrete',
        value: 'reminder',
        emoji: '🔔',
      },
    ];

    // Check for existing reminders
    const reminders = await reminderRepository.findByTaskId(taskId);
    if (reminders.length > 0) {
      options.push({
        label: `Remover Lembretes (${reminders.length})`,
        value: 'delete_reminders',
        emoji: '🗑️',
      });
    }

    // Build action select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`${TASK_COMMAND_CUSTOM_IDS.ACTION_SELECT}:${projectId}:${taskId}`)
      .setPlaceholder('Selecione uma ação')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    // Show task info embed
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${task.title}`)
      .setColor(task.done ? 0x2ecc71 : 0x3498db)
      .addFields(
        { name: 'Status', value: task.done ? '✅ Concluída' : '📝 Pendente', inline: true },
        {
          name: 'Due Date',
          value: task.due_date
            ? new Date(task.due_date).toLocaleDateString('pt-BR')
            : 'Não definida',
          inline: true,
        }
      );

    await interaction.editReply({
      content: 'Selecione uma ação:',
      embeds: [embed],
      components: [row],
    });
  } catch (error) {
    logger.error('Failed to load task details', {
      taskId,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply({
      content: '❌ Erro ao carregar detalhes da task.',
      components: [],
    });
  }
}
