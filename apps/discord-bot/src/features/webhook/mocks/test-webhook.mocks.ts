import type { VikunjaEventType } from '../../../shared/types';
import type { VikunjaTask, VikunjaProject, VikunjaUser, VikunjaLabel, VikunjaTaskAttachment } from '../../../shared/types/vikunja.types';
import type { WebhookPayload } from '../schemas/webhook.schema';

/**
 * Creates a mock user
 */
function createMockUser(id: number, name: string): VikunjaUser {
  const now = new Date().toISOString();
  return {
    id,
    username: name.toLowerCase().replace(/\s/g, '.'),
    email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
    name,
    created: now,
    updated: now,
    avatar_url: '',
  };
}

/**
 * Creates a mock label
 */
function createMockLabel(id: number, title: string, hexColor: string): VikunjaLabel {
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
 * Creates a mock task data object with all Vikunja fields
 */
function createMockTaskData(projectId: number): VikunjaTask {
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

  const mockAttachment: VikunjaTaskAttachment = {
      id: 1,
      task_id: taskId,
      file: {
          id: 1,
          name: 'especificacao.pdf',
          mime: 'application/pdf',
          size: 1024000,
      },
      created: now.toISOString(),
  };

  return {
    id: taskId,
    title: 'Tarefa de Teste - Implementar Feature',
    description: 'Esta é uma tarefa mockada completa para teste de webhook.\n\n## Objetivo\nTestar o fluxo de notificações Discord.\n\n## Critérios de Aceite\n- [ ] Notificação enviada\n- [ ] Formatação correta',
    done: false,
    done_at: undefined,
    priority: 3,
    project_id: projectId,
    created: now.toISOString(),
    updated: now.toISOString(),
    is_favorite: true,
    hex_color: '#4a90d9',

    // Date fields
    due_date: dueDate.toISOString(),
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),

    // Status and progress
    percent_done: 0.25,
    repeat_after: 0,
    repeat_mode: 0,
    

    // Position and organization
    identifier: `PROJ-${taskId}`,
    index: taskId,
    bucket_id: 1,
    position: 65536,

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

    reminders: [
         {
            id: 1,
            reminder: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
            relative_period: -86400 * 1,
            relative_to: 'due_date'
         },
         {
            id: 2,
            reminder: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString(),
            relative_period: -86400 * 3,
            relative_to: 'due_date'
         }
    ],

    related_tasks: {},
    attachments: [mockAttachment],
    cover_image_attachment_id: undefined,

    // Created by
    created_by: createMockUser(1, 'Admin User'),
  };
}

/**
 * Creates a mock project data object with all Vikunja fields
 */
function createMockProjectData(projectId: number): VikunjaProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    title: 'Projeto de Teste - Sistema',
    description: 'Este é um projeto mockado completo para teste de webhook.\n\nContém múltiplas tarefas e configurações de exemplo.',
    created: now,
    updated: now,
    identifier: `PROJ`,
    hex_color: '#2ecc71',
    is_archived: false,
    is_favorite: true,
    position: 65536,
    parent_project_id: undefined,
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
  const task = createMockTaskData(projectId);
  const doer = createMockUser(1, 'Admin User');
  return {
    event_name: eventType,
    time: new Date().toISOString(),
    data: { task, doer },
  };
}

/**
 * Creates a mock webhook payload for project events
 */
export function createMockProjectEvent(
  projectId: number,
  eventType: VikunjaEventType
): WebhookPayload {
  const project = createMockProjectData(projectId);
  const doer = createMockUser(1, 'Admin User');
  return {
    event_name: eventType,
    time: new Date().toISOString(),
    data: { project, doer },
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
