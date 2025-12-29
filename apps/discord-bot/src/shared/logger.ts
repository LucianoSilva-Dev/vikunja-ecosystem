import pino from 'pino';
import type { ILogger } from './types';
import { getLoggerConfig } from './config/logger.config';

/**
 * Creates a logger instance using pino
 */
export function createLogger(): ILogger {
  const config = getLoggerConfig();

  const pinoLogger = pino({
    level: config.level,
    name: config.name,
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  });

  return {
    info(message: string, context?: object) {
      pinoLogger.info(context ?? {}, message);
    },
    error(message: string, context?: object) {
      pinoLogger.error(context ?? {}, message);
    },
    warn(message: string, context?: object) {
      pinoLogger.warn(context ?? {}, message);
    },
    debug(message: string, context?: object) {
      pinoLogger.debug(context ?? {}, message);
    },
  };
}
