import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RunPollingCycleUseCase } from '../application/run-polling-cycle.usecase';
import { GetHealthStatusUseCase } from '../application/get-health.usecase';
import { EnvConfig } from '../adapters/system/env.config';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly pollingCycle: RunPollingCycleUseCase,
    private readonly healthStatus: GetHealthStatusUseCase,
    private readonly envConfig: EnvConfig,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handlePollingCycle() {
    if (this.isRunning) {
      this.logger.warn('Previous polling cycle still running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting scheduled polling cycle');
      
      const stats = await this.pollingCycle.execute();
      this.healthStatus.updateLastCycleTime();

      const duration = Date.now() - startTime;
      this.logger.log(`Polling cycle completed in ${duration}ms`, {
        processed: stats.processed,
        alertsSent: stats.alertsSent,
        skipped: stats.skipped,
        errors: stats.errors,
      });

      // Warn if cycle took longer than expected
      if (duration > this.envConfig.pollIntervalSeconds * 1000) {
        this.logger.warn(`Polling cycle took ${duration}ms, longer than interval ${this.envConfig.pollIntervalSeconds}s`);
      }
    } catch (error) {
      this.logger.error('Polling cycle failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get the current running status
   */
  isCycleRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Manually trigger a polling cycle (for testing)
   */
  async triggerManualCycle(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Polling cycle is already running');
    }

    await this.handlePollingCycle();
  }
}
