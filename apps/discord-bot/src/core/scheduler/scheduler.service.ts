/**
 * Scheduler Service
 *
 * Manages cron jobs for reminders and digest using croner library.
 * Jobs are persisted in the database and loaded on startup.
 */

import { Cron } from 'croner';
import type { SchedulerServiceDeps } from './types';

export class SchedulerService {
  private readonly logger: SchedulerServiceDeps['logger'];
  private readonly jobs: Map<string, Cron> = new Map();

  constructor(deps: SchedulerServiceDeps) {
    this.logger = deps.logger;
  }

  /**
   * Schedule a new cron job
   */
  schedule(
    id: string,
    cronExpression: string,
    callback: () => Promise<void>,
    options?: { startsAt?: Date }
  ): void {
    // Cancel existing job with same ID if exists
    this.cancel(id);

    const cronOptions: { timezone?: string; startAt?: string } = {
      timezone: 'America/Sao_Paulo',
    };

    // Convert Date to ISO string in local time for croner
    if (options?.startsAt && options.startsAt > new Date()) {
      // Subtract 1 second to ensure inclusive execution if it matches exactly
      const startAtAdjusted = new Date(options.startsAt.getTime() - 1000);
      cronOptions.startAt = this.formatLocalISOString(startAtAdjusted);
    }

    const job = new Cron(cronExpression, cronOptions, async () => {
      try {
        this.logger.debug('Executing scheduled job', { id, cronExpression });
        await callback();
      } catch (error) {
        this.logger.error('Scheduled job failed', {
          id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.jobs.set(id, job);
    this.logger.info('Job scheduled', {
      id,
      cronExpression,
      nextRun: job.nextRun()?.toISOString(),
    });
  }

  /**
   * Cancel a scheduled job
   */
  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
      this.logger.debug('Job cancelled', { id });
      return true;
    }
    return false;
  }

  /**
   * Get next run time for a cron expression
   */
  getNextRun(cronExpression: string, startsAt?: Date): Date | null {
    try {
      // Convert Date to ISO string in local time for croner
      // Croner expects startAt as ISO 8601 in local time (according to timezone)
      let startAtStr: string | undefined;
      if (startsAt) {
        // Format as local ISO string (without timezone offset)
        startAtStr = this.formatLocalISOString(startsAt);
      }

      const testJob = new Cron(cronExpression, {
        timezone: 'America/Sao_Paulo',
        startAt: startAtStr,
      });
      const next = testJob.nextRun();
      testJob.stop();
      return next;
    } catch {
      return null;
    }
  }

  /**
   * Format a Date as ISO string in local time (without timezone offset)
   * Example: 2026-01-08T14:49:00
   */
  private formatLocalISOString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  /**
   * Validate a cron expression
   */
  isValidCron(cronExpression: string): boolean {
    try {
      const testJob = new Cron(cronExpression);
      testJob.stop();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get number of active jobs
   */
  getActiveJobCount(): number {
    return this.jobs.size;
  }

  /**
   * Stop all scheduled jobs (graceful shutdown)
   */
  stopAll(): void {
    this.logger.info('Stopping all scheduled jobs', { count: this.jobs.size });
    for (const [id, job] of this.jobs) {
      job.stop();
      this.logger.debug('Job stopped', { id });
    }
    this.jobs.clear();
  }
}

export function createSchedulerService(deps: SchedulerServiceDeps): SchedulerService {
  return new SchedulerService(deps);
}
