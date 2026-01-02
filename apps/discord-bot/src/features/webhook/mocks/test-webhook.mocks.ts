import type { VikunjaEventType } from '../../../shared/types';
import type { WebhookPayload } from '../schemas/webhook.schema';

/**
 * Mock user type for assignees and created_by
 */
interface MockUser {
  id: number;
  username: string;
  email: string;
  name: string;
  created: string;
  updated: string;
}

/**
 * Mock label type
 */
interface MockLabel {
  id: number;
  title: string;
  description: string;
  hex_color: string;
  created_by: MockUser;
  created: string;
  updated: string;
}

/**
 * Mock reminder type
 */
interface MockReminder {
  id: number;
  reminder: string;
  relative_period: number;
  relative_to: string;
}

/**
 * Extended task data with all Vikunja fields
 */
interface ExtendedTaskData {
  id: number;
  title: string;
  description: string;
  done: boolean;
  done_at: string | null;
  priority: number;
  project_id: number;
  created: string;
  updated: string;

  // Date fields
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;

  // Status and progress
  percent_done: number;
  is_favorite: boolean;
  hex_color: string;

  // Repetition
  repeat_after: number;
  repeat_mode: number;

  // Position and organization
  identifier: string;
  index: number;
  bucket_id: number;
  position: number;
  kanban_position: number;

  // Related data
  assignees: MockUser[];
  labels: MockLabel[];
  reminders: MockReminder[];
  related_tasks: Record<string, unknown[]>;
  attachments: unknown[];
  cover_image_attachment_id: number | null;

  // User info
  created_by: MockUser;
}

/**
 * Extended project data with all Vikunja fields
 */
interface ExtendedProjectData {
  id: number;
  title: string;
  description: string;
  created: string;
  updated: string;

  // Additional fields
  identifier: string;
  hex_color: string;
  is_archived: boolean;
  is_favorite: boolean;
  position: number;
  parent_project_id: number | null;
  default_bucket_id: number;
  done_bucket_id: number;
  background_information: unknown | null;
  background_blur_hash: string;

  // User info
  owner: MockUser;
}

/**
 * Creates a mock user
 */
function createMockUser(id: number, name: string): MockUser {
  const now = new Date().toISOString();
  return {
    id,
    username: name.toLowerCase().replace(/\s/g, '.'),
    email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
    name,
    created: now,
    updated: now,
  };
}

/**
 * Creates a mock label
 */
function createMockLabel(id: number, title: string, hexColor: string): MockLabel {
  const now = new Date().toISOString();
  return {
    id,
    title,
    description: `Label: ${title}`,
    hex_color: hexColor,
    created_by: createMockUser(1, 'Admin User'),
    created: now,
    updated: now,
  };
}

/**
 * Creates a mock reminder
 */
function createMockReminder(id: number, daysFromNow: number): MockReminder {
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + daysFromNow);
  return {
    id,
    reminder: reminderDate.toISOString(),
    relative_period: -86400 * daysFromNow, // seconds
    relative_to: 'due_date',
  };
}

/**
 * Creates a mock task data object with all Vikunja fields
 */
function createMockTaskData(projectId: number): ExtendedTaskData {
  const now = new Date();
  const taskId = Math.floor(Math.random() * 10000) + 1;
  
  // Due date: 7 days from now
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);
  
  // Start date: tomorrow
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  
  // End date: 5 days from now
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 5);

  return {
    id: taskId,
    title: 'Tarefa de Teste - Implementar Feature',
    description: 'Esta é uma tarefa mockada completa para teste de webhook.\n\n## Objetivo\nTestar o fluxo de notificações Discord.\n\n## Critérios de Aceite\n- [ ] Notificação enviada\n- [ ] Formatação correta',
    done: false,
    done_at: null,
    priority: 3,
    project_id: projectId,
    created: now.toISOString(),
    updated: now.toISOString(),

    // Date fields
    due_date: dueDate.toISOString(),
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),

    // Status and progress
    percent_done: 0.25,
    is_favorite: true,
    hex_color: '#4a90d9',

    // Repetition
    repeat_after: 0,
    repeat_mode: 0,

    // Position and organization
    identifier: `PROJ-${taskId}`,
    index: taskId,
    bucket_id: 1,
    position: 65536,
    kanban_position: 32768,

    // Assignees
    assignees: [
      createMockUser(1, 'João Silva'),
      createMockUser(2, 'Maria Santos'),
    ],

    // Labels
    labels: [
      createMockLabel(1, 'Bug', '#e74c3c'),
      createMockLabel(2, 'Prioridade Alta', '#f39c12'),
      createMockLabel(3, 'Backend', '#3498db'),
    ],

    // Reminders
    reminders: [
      createMockReminder(1, 1), // 1 day before due
      createMockReminder(2, 3), // 3 days before due
    ],

    // Related data
    related_tasks: {},
    attachments: [
      {
        id: 1,
        task_id: taskId,
        file: {
          id: 1,
          name: 'especificacao.pdf',
          mime: 'application/pdf',
          size: 1024000,
        },
        created: now.toISOString(),
      },
    ],
    cover_image_attachment_id: null,

    // Created by
    created_by: createMockUser(1, 'Admin User'),
  };
}

/**
 * Creates a mock project data object with all Vikunja fields
 */
function createMockProjectData(projectId: number): ExtendedProjectData {
  const now = new Date().toISOString();
  return {
    id: projectId,
    title: 'Projeto de Teste - Sistema',
    description: 'Este é um projeto mockado completo para teste de webhook.\n\nContém múltiplas tarefas e configurações de exemplo.',
    created: now,
    updated: now,

    // Additional fields
    identifier: `PROJ`,
    hex_color: '#2ecc71',
    is_archived: false,
    is_favorite: true,
    position: 65536,
    parent_project_id: null,
    default_bucket_id: 1,
    done_bucket_id: 2,
    background_information: null,
    background_blur_hash: '',

    // Owner
    owner: createMockUser(1, 'Admin User'),
  };
}

/**
 * Creates a mock webhook payload for task events
 */
export function createMockTaskEvent(
  projectId: number,
  eventType: VikunjaEventType
): WebhookPayload {
  return {
    event_name: eventType,
    time: new Date().toISOString(),
    data: createMockTaskData(projectId),
  };
}

/**
 * Creates a mock webhook payload for project events
 */
export function createMockProjectEvent(
  projectId: number,
  eventType: VikunjaEventType
): WebhookPayload {
  return {
    event_name: eventType,
    time: new Date().toISOString(),
    data: createMockProjectData(projectId),
  };
}

/**
 * Creates a mock webhook event based on the event type
 */
export function createMockWebhookEvent(
  projectId: number,
  eventType: VikunjaEventType
): WebhookPayload {
  if (eventType.startsWith('project.')) {
    return createMockProjectEvent(projectId, eventType);
  }
  return createMockTaskEvent(projectId, eventType);
}
