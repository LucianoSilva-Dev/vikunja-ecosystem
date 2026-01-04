/**
 * Task Actions Feature Module
 *
 * Public exports for the task-actions feature
 */

// Types
export {
  TASK_ACTION_PREFIX,
  type TaskActionType,
  type ParsedTaskAction,
  type TaskActionResult,
  parseTaskActionCustomId,
  isTaskActionCustomId,
} from './types';

// Services
export {
  TaskActionService,
  createTaskActionService,
  type TaskActionServiceDeps,
} from './services/task-action.service';

// Handlers
export {
  TaskActionButtonHandler,
  createTaskActionButtonHandler,
  type TaskActionButtonHandlerDeps,
} from './handlers/button.handler';

export {
  TaskActionModalHandler,
  createTaskActionModalHandler,
  type TaskActionModalHandlerDeps,
} from './handlers/modal.handler';
