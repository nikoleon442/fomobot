import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

import { AppController } from './interface/http.controller';
import { SchedulerService } from './interface/scheduler.service';
import { RunPollingCycleUseCase } from './application/run-polling-cycle.usecase';
import { GetHealthStatusUseCase } from './application/get-health.usecase';

// Adapters
import { CoinGeckoAdapter } from './adapters/providers/coingecko.adapter';
import { CMCAdapter } from './adapters/providers/cmc.adapter';
import { BirdeyeAdapter } from './adapters/providers/birdeye.adapter';
import { DexScreenerAdapter } from './adapters/providers/dexscreener.adapter';
import { GeckoTerminalAdapter } from './adapters/providers/geckoterminal.adapter';
import { SupabaseReader } from './adapters/persistence/supabase-reader';
import { SupabaseMilestoneConfigReader } from './adapters/persistence/supabase-milestone-config-reader';
import { SupabaseMilestoneWriter } from './adapters/persistence/supabase-milestone-writer';
import { TelegramAdapter } from './adapters/notifier/telegram.adapter';
import { EnvConfig } from './adapters/system/env.config';
import { ClockAdapter } from './adapters/system/clock.adapter';
import { LoggerAdapter } from './adapters/system/logger.adapter';

// Provider factory
import { MarketCapProviderFactory } from './adapters/providers/provider.factory';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    HttpModule,
  ],
  controllers: [AppController],
  providers: [
    // Configuration
    EnvConfig,
    
    // System adapters
    ClockAdapter,
    LoggerAdapter,
    
    // Provider adapters
    CoinGeckoAdapter,
    CMCAdapter,
    BirdeyeAdapter,
    DexScreenerAdapter,
    GeckoTerminalAdapter,
    MarketCapProviderFactory,
    
    // Data adapters
    SupabaseReader,
    SupabaseMilestoneConfigReader,
    SupabaseMilestoneWriter,
    TelegramAdapter,
    
    // Provide interfaces with concrete implementations
    {
      provide: 'TokenRepositoryPort',
      useClass: SupabaseReader,
    },
    {
      provide: 'MilestoneConfigRepositoryPort',
      useClass: SupabaseMilestoneConfigReader,
    },
    {
      provide: 'MilestoneNotificationRepositoryPort',
      useClass: SupabaseMilestoneWriter,
    },
    {
      provide: 'NotifierPort', 
      useClass: TelegramAdapter,
    },
    {
      provide: 'ClockPort',
      useClass: ClockAdapter,
    },
    {
      provide: 'LoggerPort',
      useClass: LoggerAdapter,
    },
    
    // Use Cases
    RunPollingCycleUseCase,
    GetHealthStatusUseCase,
    
    // Scheduler
    SchedulerService,
  ],
})
export class AppModule {}
