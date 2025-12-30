import { z } from 'zod';
import { Env } from './config';

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

  // Optional
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    throw new Error('Environment not loaded. Call loadEnv() first.');
  }
  return cachedEnv;
}
