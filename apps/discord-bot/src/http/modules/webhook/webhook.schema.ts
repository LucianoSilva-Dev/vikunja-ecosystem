import { z } from 'zod';

/**
 * Base webhook payload schema
 */
export const webhookPayloadSchema = z.object({
  event_name: z.string(),
  time: z.string(),
  data: z.unknown(),
});

/**
 * Task data schema
 */
export const taskDataSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().optional(),
  done: z.boolean().optional(),
  priority: z.number().optional(),
  project_id: z.number(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

/**
 * Project data schema
 */
export const projectDataSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type TaskData = z.infer<typeof taskDataSchema>;
export type ProjectData = z.infer<typeof projectDataSchema>;
