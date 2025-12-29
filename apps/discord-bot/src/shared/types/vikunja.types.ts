/**
 * Vikunja event types for webhooks and notifications
 */

export type VikunjaEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.assignee.created'
  | 'task.comment.created'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted';
