import { getEnv } from '../env';

export interface HttpConfig {
  port: number;
  host: string;
}

export function getHttpConfig(): HttpConfig {
  const env = getEnv();

  return {
    port: env.PORT,
    host: env.HOST,
  };
}
