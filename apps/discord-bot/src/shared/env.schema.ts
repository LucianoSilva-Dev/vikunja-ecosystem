import { z } from 'zod';

export const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),

  // HTTP Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Vikunja
  VIKUNJA_API_URL: z.url('VIKUNJA_API_URL must be a valid URL'),
  VIKUNJA_API_TOKEN: z.string().min(1, 'VIKUNJA_API_TOKEN is required'),
  VIKUNJA_WEBHOOK_SECRET: z.string().min(1, 'VIKUNJA_WEBHOOK_SECRET is required'),
  VIKUNJA_BOT_WEBHOOK_URL: z.url('VIKUNJA_BOT_WEBHOOK_URL must be a valid URL'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Optional
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;
