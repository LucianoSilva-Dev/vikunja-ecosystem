/**
 * Types for task-actions feature module
 */

/**
 * Prefixo para custom IDs de task actions
 */
export const TASK_ACTION_PREFIX = 'task_action';

/**
 * Tipos de ações de task disponíveis
 */
export type TaskActionType =
  | 'mark_complete'
  | 'reopen'
  | 'assign_me'
  | 'assign_user'
  | 'reminder'
  | 'due_date';

/**
 * Dados parseados de um custom ID de task action
 */
export interface ParsedTaskAction {
  action: TaskActionType;
  taskId: number;
  extra?: string; // Para dados adicionais como userId
}

/**
 * Resultado de uma ação de task
 */
export interface TaskActionResult {
  success: boolean;
  message: string;
  taskTitle?: string;
  error?: string;
}

/**
 * Parseia um custom ID de task action
 * Formato: task_action:<action>:<taskId>[:<extra>]
 */
export function parseTaskActionCustomId(customId: string): ParsedTaskAction | null {
  const parts = customId.split(':');
  
  if (parts.length < 3 || parts[0] !== TASK_ACTION_PREFIX) {
    return null;
  }

  const action = parts[1] as TaskActionType;
  const taskId = parseInt(parts[2], 10);

  if (isNaN(taskId)) {
    return null;
  }

  return {
    action,
    taskId,
    extra: parts[3],
  };
}

/**
 * Verifica se um custom ID é uma task action
 */
export function isTaskActionCustomId(customId: string): boolean {
  return customId.startsWith(`${TASK_ACTION_PREFIX}:`);
}
