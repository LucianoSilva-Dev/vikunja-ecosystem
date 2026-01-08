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

// Command
export {
  TASK_COMMAND_NAME,
  taskCommandData,
} from './commands/task.command';

// Services
export {
  TaskActionService,
  createTaskActionService,
  type TaskActionServiceDeps,
} from './services/task-action.service';

export {
  ReminderService,
  createReminderService,
  type ReminderServiceDeps,
} from './services/reminder.service';

// Repositories
export {
  ReminderRepository,
  createReminderRepository,
  type ReminderRepositoryDeps,
  type ReminderRecord,
} from './repositories/reminder.repository';

// Handlers - Button & Modal (quick actions)
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

// Handlers - /task command
export {
  TASK_COMMAND_CUSTOM_IDS,
  handleTaskCommand,
  handleTaskProjectSelect,
  handleTaskTaskSelect,
  type TaskCommandHandlerDeps,
} from './handlers/task-command.handler';

export {
  handleTaskActionSelect,
  handleDeleteRemindersSubmit,
  REMINDER_MODAL_CUSTOM_ID,
  type ActionSelectHandlerDeps,
} from './handlers/action-select.handler';

export {
  canHandleReminderModal,
  handleReminderModalSubmit,
  type ReminderModalHandlerDeps,
} from './handlers/reminder-modal.handler';

export {
  REMINDER_TYPE_SELECT_CUSTOM_ID,
  REMINDER_CONFIG_MODAL_PREFIX,
  REMINDER_TYPES,
  type ReminderType,
  type ReminderTypeSelectHandlerDeps,
  canHandleReminderTypeSelect,
  canHandleReminderConfigModal,
  showReminderTypeSelect,
  handleReminderTypeSelect,
} from './handlers/reminder-type-select.handler';
