import { getEnv } from '../env';

export interface VikunjaConfig {
  apiUrl: string;
  apiToken: string;
  webhookSecret: string;
}

export function getVikunjaConfig(): VikunjaConfig {
  const env = getEnv();

  return {
    apiUrl: env.VIKUNJA_API_URL,
    apiToken: env.VIKUNJA_API_TOKEN,
    webhookSecret: env.VIKUNJA_WEBHOOK_SECRET,
  };
}
