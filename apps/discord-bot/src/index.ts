import dotenv from 'dotenv';

// Load .env file before anything else
dotenv.config();

import { createApp } from './app';
import { getDiscordConfig, getHttpConfig } from './shared/config';

async function bootstrap() {
  const app = createApp();
  const { logger, discordClient, httpServer } = app;

  const discordConfig = getDiscordConfig();
  const httpConfig = getHttpConfig();

  try {
    // Login to Discord
    await discordClient.login(discordConfig.token);
    logger.info('Discord bot connected');

    // Start HTTP server
    await httpServer.listen({
      port: httpConfig.port,
      host: httpConfig.host,
    });
    logger.info(`HTTP server listening on ${httpConfig.host}:${httpConfig.port}`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down...`);

      try {
        await httpServer.close();
        logger.info('HTTP server closed');

        discordClient.destroy();
        logger.info('Discord client destroyed');

        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start application', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
