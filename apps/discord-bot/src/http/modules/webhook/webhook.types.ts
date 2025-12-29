import type { VikunjaEventType } from '../../../shared/types';

/**
 * Parsed webhook event
 */
export interface WebhookEvent {
  eventType: VikunjaEventType;
  timestamp: Date;
  data: TaskEventData | ProjectEventData;
}

/**
 * Task event data
 */
export interface TaskEventData {
  type: 'task';
  id: number;
  title: string;
  description?: string;
  done?: boolean;
  priority?: number;
  projectId: number;
}

/**
 * Project event data
 */
export interface ProjectEventData {
  type: 'project';
  id: number;
  title: string;
  description?: string;
}

/**
 * Webhook validation result
 */
export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
}
