import { getEnv } from '.';

export interface LoggerConfig {
  level: string;
  name?: string;
}

export function getLoggerConfig(): LoggerConfig {
  const env = getEnv();

  return {
    level: env.LOG_LEVEL,
    name: 'vikunja-discord-bot',
  };
}
