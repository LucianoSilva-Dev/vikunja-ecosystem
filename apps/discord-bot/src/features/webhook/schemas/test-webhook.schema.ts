import { z } from 'zod';

/**
 * Vikunja event types enum for request validation
 */
export const vikunjaEventTypeSchema = z.enum([
  'task.created',
  'task.updated',
  'task.deleted',
  'task.assignee.created',
  'task.comment.created',
  'project.created',
  'project.updated',
  'project.deleted',
]);

/**
 * Request schema for test webhook endpoint
 */
export const testWebhookRequestSchema = z.object({
  projectId: z.number().int().positive().describe('ID do projeto Vikunja'),
  eventType: vikunjaEventTypeSchema.describe('Tipo de evento a simular'),
});

/**
 * Response schema for test webhook endpoint
 */
export const testWebhookResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  event: z.object({
    event_name: z.string(),
    time: z.string(),
    data: z.unknown(),
  }),
});

export type TestWebhookRequest = z.infer<typeof testWebhookRequestSchema>;
export type TestWebhookResponse = z.infer<typeof testWebhookResponseSchema>;
