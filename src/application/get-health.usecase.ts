import { Injectable, Inject } from '@nestjs/common';
import { MarketCapProviderPort } from '../ports/market-cap-provider.port';
import { TokenRepositoryPort } from '../ports/token-repository.port';
import { NotifierPort } from '../ports/notifier.port';
import { ClockPort } from '../ports/clock.port';
import { HealthStatus, CycleStats } from '../domain/types';
import { RunPollingCycleUseCase } from './run-polling-cycle.usecase';
import { MarketCapProviderFactory } from '../adapters/providers/provider.factory';

@Injectable()
export class GetHealthStatusUseCase {
  private startTime: Date;
  private lastCycleAt?: Date;
  private marketCapProvider: MarketCapProviderPort;

  constructor(
    private readonly providerFactory: MarketCapProviderFactory,
    @Inject('TokenRepositoryPort') private readonly tokenRepository: TokenRepositoryPort,
    @Inject('NotifierPort') private readonly notifier: NotifierPort,
    @Inject('ClockPort') private readonly clock: ClockPort,
    private readonly pollingCycle: RunPollingCycleUseCase,
  ) {
    this.startTime = this.clock.now();
    this.marketCapProvider = this.providerFactory.getProvider();
  }

  async execute(): Promise<HealthStatus> {
    const uptime = this.clock.timestamp() - this.startTime.getTime();
    const stats = this.pollingCycle.getCurrentStats();

    // Check health of all components
    const [providerHealthy, repositoryHealthy, notifierHealthy] = await Promise.all([
      this.marketCapProvider.isHealthy(),
      this.tokenRepository.isHealthy(),
      this.notifier.isHealthy(),
    ]);

    // Determine overall status
    const allHealthy = providerHealthy && repositoryHealthy && notifierHealthy;
    const someHealthy = providerHealthy || repositoryHealthy || notifierHealthy;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allHealthy) {
      status = 'healthy';
    } else if (someHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      uptime,
      lastCycleAt: this.lastCycleAt,
      provider: this.marketCapProvider.getProviderName(),
      stats,
    };
  }

  updateLastCycleTime(): void {
    this.lastCycleAt = this.clock.now();
  }
}
