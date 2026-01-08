/**
 * Scheduler Service Types
 */

export interface ScheduledJob {
  id: string;
  cronExpression: string;
  startsAt?: Date;
  nextRunAt: Date;
  callback: () => Promise<void>;
}

export interface SchedulerServiceDeps {
  logger: {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}
