/**
 * Task Action Service
 *
 * Handles task operations triggered from Discord buttons
 */

import type { ILogger } from '../../../shared/types';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';
import type { TaskActionResult } from '../types';

export interface TaskActionServiceDeps {
  logger: ILogger;
  vikunjaApi: VikunjaApiService;
}

export class TaskActionService {
  private readonly logger: ILogger;
  private readonly vikunjaApi: VikunjaApiService;

  constructor(deps: TaskActionServiceDeps) {
    this.logger = deps.logger;
    this.vikunjaApi = deps.vikunjaApi;
  }

  /**
   * Mark task as complete (idempotent - does nothing if already complete)
   */
  async markComplete(taskId: number): Promise<TaskActionResult> {
    this.logger.debug('Marking task as complete', { taskId });
    
    try {
      const task = await this.vikunjaApi.getTaskById(taskId);
      
      if (!task) {
        return {
          success: false,
          message: 'Task não encontrada',
          error: 'TASK_NOT_FOUND',
        };
      }

      // Idempotente: se já está concluída, apenas confirma
      if (task.done) {
        return {
          success: true,
          message: '✅ Task já está concluída!',
          taskTitle: task.title,
        };
      }

      await this.vikunjaApi.updateTask(taskId, { done: true });

      return {
        success: true,
        message: '✅ Task marcada como concluída!',
        taskTitle: task.title,
      };
    } catch (error) {
      this.logger.error('Failed to mark task complete', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        message: 'Erro ao concluir task',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Reopen task (idempotent - does nothing if already open)
   */
  async reopenTask(taskId: number): Promise<TaskActionResult> {
    this.logger.debug('Reopening task', { taskId });
    
    try {
      const task = await this.vikunjaApi.getTaskById(taskId);
      
      if (!task) {
        return {
          success: false,
          message: 'Task não encontrada',
          error: 'TASK_NOT_FOUND',
        };
      }

      // Idempotente: se já está aberta, apenas confirma
      if (!task.done) {
        return {
          success: true,
          message: '🔄 Task já está aberta!',
          taskTitle: task.title,
        };
      }

      await this.vikunjaApi.updateTask(taskId, { done: false });

      return {
        success: true,
        message: '🔄 Task reaberta!',
        taskTitle: task.title,
      };
    } catch (error) {
      this.logger.error('Failed to reopen task', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        message: 'Erro ao reabrir task',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Assign task to a user (by Vikunja user ID)
   */
  async assignToUser(taskId: number, vikunjaUserId: number): Promise<TaskActionResult> {
    this.logger.debug('Assigning task to user', { taskId, vikunjaUserId });
    
    try {
      const task = await this.vikunjaApi.getTaskById(taskId);
      
      if (!task) {
        return {
          success: false,
          message: 'Task não encontrada',
          error: 'TASK_NOT_FOUND',
        };
      }

      // Verificar se já está atribuído
      const isAlreadyAssigned = task.assignees?.some(
        (assignee) => assignee.id === vikunjaUserId
      );

      if (isAlreadyAssigned) {
        return {
          success: true,
          message: '👤 Você já está atribuído a esta task!',
          taskTitle: task.title,
        };
      }

      await this.vikunjaApi.assignTask(taskId, vikunjaUserId);

      return {
        success: true,
        message: '👤 Task atribuída com sucesso!',
        taskTitle: task.title,
      };
    } catch (error) {
      this.logger.error('Failed to assign task', {
        taskId,
        vikunjaUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        message: 'Erro ao atribuir task',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update task due date
   */
  async updateDueDate(taskId: number, dueDate: Date): Promise<TaskActionResult> {
    this.logger.debug('Updating task due date', { taskId, dueDate });
    
    try {
      const task = await this.vikunjaApi.getTaskById(taskId);
      
      if (!task) {
        return {
          success: false,
          message: 'Task não encontrada',
          error: 'TASK_NOT_FOUND',
        };
      }

      await this.vikunjaApi.updateTask(taskId, { due_date: dueDate.toISOString() });

      return {
        success: true,
        message: `📅 Due date atualizada para ${dueDate.toLocaleDateString('pt-BR')}!`,
        taskTitle: task.title,
      };
    } catch (error) {
      this.logger.error('Failed to update task due date', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        success: false,
        message: 'Erro ao atualizar due date',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export function createTaskActionService(deps: TaskActionServiceDeps): TaskActionService {
  return new TaskActionService(deps);
}
