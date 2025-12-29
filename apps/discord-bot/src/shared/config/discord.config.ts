import { getEnv } from './env';

export interface DiscordConfig {
  token: string;
  clientId: string;
}

export function getDiscordConfig(): DiscordConfig {
  const env = getEnv();

  return {
    token: env.DISCORD_TOKEN,
    clientId: env.DISCORD_CLIENT_ID,
  };
}
