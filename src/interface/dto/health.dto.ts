import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CycleStatsDto {
  @IsNumber()
  processed: number;

  @IsNumber()
  alertsSent: number;

  @IsNumber()
  skipped: number;

  @IsNumber()
  errors: number;

  @IsDateString()
  startTime: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class HealthStatusDto {
  @IsString()
  status: 'healthy' | 'degraded' | 'unhealthy';

  @IsNumber()
  uptime: number;

  @IsOptional()
  @IsDateString()
  lastCycleAt?: string;

  @IsString()
  provider: string;

  @Type(() => CycleStatsDto)
  stats: CycleStatsDto;
}

export class TriggerResponseDto {
  @IsString()
  message: string;

  @Type(() => Boolean)
  success: boolean;
}

export class RootResponseDto {
  @IsString()
  message: string;

  @IsString()
  version: string;
}
