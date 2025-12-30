import { getEnv } from '../env';

export interface DatabaseConfig {
  url: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const env = getEnv();

  return {
    url: env.DATABASE_URL,
  };
}
