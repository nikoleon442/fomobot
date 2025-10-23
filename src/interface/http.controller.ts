import { Controller, Get, Post, HttpException, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { GetHealthStatusUseCase } from '../application/get-health.usecase';
import { SchedulerService } from './scheduler.service';
import { HealthStatus, CycleStats } from '../domain/types';
import { HealthStatusDto, TriggerResponseDto, RootResponseDto } from './dto/health.dto';

@Controller()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AppController {
  constructor(
    private readonly healthStatus: GetHealthStatusUseCase,
    private readonly scheduler: SchedulerService,
  ) {}

  @Get('health')
  async getHealth(): Promise<HealthStatusDto> {
    try {
      const health = await this.healthStatus.execute();
      return {
        status: health.status,
        uptime: health.uptime,
        lastCycleAt: health.lastCycleAt?.toISOString(),
        provider: health.provider,
        stats: {
          processed: health.stats.processed,
          alertsSent: health.stats.alertsSent,
          skipped: health.stats.skipped,
          errors: health.stats.errors,
          startTime: health.stats.startTime.toISOString(),
          endTime: health.stats.endTime?.toISOString(),
          duration: health.stats.duration,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Health check failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats')
  async getStats(): Promise<CycleStats> {
    try {
      const health = await this.healthStatus.execute();
      return health.stats;
    } catch (error) {
      throw new HttpException(
        {
          message: 'Stats retrieval failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('trigger')
  async triggerManualCycle(): Promise<TriggerResponseDto> {
    try {
      if (this.scheduler.isCycleRunning()) {
        return {
          message: 'Polling cycle is already running',
          success: false,
        };
      }

      await this.scheduler.triggerManualCycle();
      return {
        message: 'Manual polling cycle triggered successfully',
        success: true,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to trigger manual cycle',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  getRoot(): RootResponseDto {
    return {
      message: 'FOMObot - Token Market Cap Monitoring Service',
      version: '1.0.0',
    };
  }
}
