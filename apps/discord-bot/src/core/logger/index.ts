import pino from 'pino';
import type { ILogger } from '../../shared/types';

export interface LoggerConfig {
  level: string;
  name?: string;
}

/**
 * Creates a logger instance using pino
 */
export function createLogger(config: LoggerConfig): ILogger {
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
