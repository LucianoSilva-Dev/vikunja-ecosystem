import { z } from 'zod';

/**
 * Schema for project binding input validation
 */
export const projectBindingSchema = z.object({
  projectId: z.number().int().positive('Project ID must be a positive integer'),
  projectName: z.string().min(1, 'Project name is required'),
  webhookEvents: z.array(z.string()).default([]),
});

export type ProjectBindingInput = z.infer<typeof projectBindingSchema>;

/**
 * Schema for setup DM command input
 */
export const setupDmInputSchema = z.object({
  projectIds: z
    .array(z.number().int().positive())
    .min(1, 'At least one project must be selected'),
});

export type SetupDmInput = z.infer<typeof setupDmInputSchema>;

/**
 * Schema for setup guild command input
 */
export const setupGuildInputSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  projectId: z.number().int().positive('Project ID must be a positive integer'),
});

export type SetupGuildInput = z.infer<typeof setupGuildInputSchema>;

/**
 * Schema for removing a project
 */
export const removeProjectInputSchema = z.object({
  projectId: z.number().int().positive('Project ID must be a positive integer'),
});

export type RemoveProjectInput = z.infer<typeof removeProjectInputSchema>;
