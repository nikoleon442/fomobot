import { Injectable, Inject } from '@nestjs/common';
import { MarketCapProviderPort } from '../ports/market-cap-provider.port';
import { TokenRepositoryPort } from '../ports/token-repository.port';
import { MilestoneConfigRepositoryPort } from '../ports/milestone-config-repository.port';
import { MilestoneNotificationRepositoryPort } from '../ports/milestone-notification-repository.port';
import { NotifierPort } from '../ports/notifier.port';
import { ClockPort } from '../ports/clock.port';
import { LoggerPort } from '../ports/logger.port';
import { Token, Group, CycleStats, USD, MilestoneConfig } from '../domain/types';
import { MilestonePolicy } from '../domain/milestone-policy';
import { MessageBuilder } from '../domain/message-builder';
import { EnvConfig } from '../adapters/system/env.config';
import { MarketCapProviderFactory } from '../adapters/providers/provider.factory';

@Injectable()
export class RunPollingCycleUseCase {
  private currentStats: CycleStats;
  private marketCapProvider: MarketCapProviderPort;

  constructor(
    private readonly providerFactory: MarketCapProviderFactory,
    @Inject('TokenRepositoryPort') private readonly tokenRepository: TokenRepositoryPort,
    @Inject('MilestoneConfigRepositoryPort') private readonly milestoneConfigRepository: MilestoneConfigRepositoryPort,
    @Inject('MilestoneNotificationRepositoryPort') private readonly milestoneNotificationRepository: MilestoneNotificationRepositoryPort,
    @Inject('NotifierPort') private readonly notifier: NotifierPort,
    @Inject('ClockPort') private readonly clock: ClockPort,
    @Inject('LoggerPort') private readonly logger: LoggerPort,
    private readonly envConfig: EnvConfig,
  ) {
    this.currentStats = this.initializeStats();
    this.marketCapProvider = this.providerFactory.getProvider();
  }

  async execute(): Promise<CycleStats> {
    this.logger.info('Starting polling cycle');
    this.currentStats = this.initializeStats();

    try {
      // Process FSM group independently
      await this.processGroup('fsm');
      
      // Process Issam group independently  
      await this.processGroup('issam');

      this.currentStats.endTime = this.clock.now();
      this.currentStats.duration = this.currentStats.endTime.getTime() - this.currentStats.startTime.getTime();

      this.logger.info('Polling cycle completed', {
        processed: this.currentStats.processed,
        alertsSent: this.currentStats.alertsSent,
        skipped: this.currentStats.skipped,
        errors: this.currentStats.errors,
        duration: this.currentStats.duration,
      });

      return this.currentStats;
    } catch (error) {
      this.logger.error('Polling cycle failed', { error: error.message });
      this.currentStats.errors++;
      throw error;
    }
  }

  private async processGroup(group: Group): Promise<void> {
    this.logger.info(`Processing group: ${group}`);

    try {
      // Load active milestones for this group
      const activeMilestones = await this.milestoneConfigRepository.getActiveMilestones(group);
      this.logger.info(`Found ${activeMilestones.length} active milestones for group ${group}`);

      if (activeMilestones.length === 0) {
        this.logger.warn(`No active milestones configured for group ${group}`);
        return;
      }

      // Create milestone policy for this group
      const milestonePolicy = new MilestonePolicy(activeMilestones);

      // Fetch tokens for this group
      const tokens = await this.tokenRepository.listAll(group);
      this.logger.info(`Found ${tokens.length} tokens for group ${group}`);

      if (tokens.length === 0) {
        return;
      }

      // Fetch market cap data
      const marketCaps = await this.marketCapProvider.getCaps(tokens);
      this.logger.info(`Fetched market cap data for ${Object.keys(marketCaps).length} tokens`);

      // Process each token
      for (const token of tokens) {
        await this.processToken(token, marketCaps[token.tokenAddress], group, milestonePolicy);
      }
    } catch (error) {
      this.logger.error(`Error processing group ${group}`, { error: error.message });
      this.currentStats.errors++;
    }
  }

  private async processToken(token: Token, currentCap: USD | null, group: Group, milestonePolicy: MilestonePolicy): Promise<void> {
    this.currentStats.processed++;

    if (currentCap === null) {
      this.logger.warn(`No market cap data for token ${token.symbol}`, {
        tokenAddress: token.tokenAddress,
      });
      this.currentStats.skipped++;
      return;
    }

    try {
      // Check for milestone crossings
      const crossedMilestones = milestonePolicy.crossed(
        token.initialMarketCapUsd,
        currentCap,
      );

      // Send alerts for each crossed milestone (check if already notified)
      for (const milestone of crossedMilestones) {
        await this.sendMilestoneAlert(token, milestone, currentCap, group);
      }
    } catch (error) {
      this.logger.error(`Error processing token ${token.symbol}`, {
        tokenAddress: token.tokenAddress,
        error: error.message,
      });
      this.currentStats.errors++;
    }
  }

  private async sendMilestoneAlert(
    token: Token,
    milestone: MilestoneConfig,
    currentCap: USD,
    group: Group,
  ): Promise<void> {
    try {
      // Check if this milestone has already been notified for this token
      const alreadyNotified = await this.milestoneNotificationRepository.wasNotified(
        token.id, 
        milestone.milestoneValue
      );

      if (alreadyNotified) {
        this.logger.info(`Milestone ${milestone.milestoneLabel} already notified for ${token.symbol}`, {
          tokenId: token.id.toString(),
          milestoneValue: milestone.milestoneValue,
        });
        return;
      }

      // Send the notification first
      const message = MessageBuilder.buildMilestoneMessage(token, milestone, currentCap, group);
      await this.notifier.send(group, message);

      // Only record the notification in the database if sending was successful
      await this.milestoneNotificationRepository.recordNotification(
        token,
        milestone,
        group
      );

      this.currentStats.alertsSent++;
      this.logger.info(`Sent milestone alert for ${token.symbol}`, {
        milestoneLabel: milestone.milestoneLabel,
        milestoneValue: milestone.milestoneValue,
        group,
        tokenAddress: token.tokenAddress,
      });
    } catch (error) {
      this.logger.error(`Failed to send milestone alert for ${token.symbol}`, {
        milestoneLabel: milestone.milestoneLabel,
        milestoneValue: milestone.milestoneValue,
        group,
        error: error.message,
      });
      this.currentStats.errors++;
      // Note: We don't record the notification in the database if sending failed
    }
  }

  private initializeStats(): CycleStats {
    return {
      processed: 0,
      alertsSent: 0,
      skipped: 0,
      errors: 0,
      startTime: this.clock.now(),
    };
  }

  getCurrentStats(): CycleStats {
    return { ...this.currentStats };
  }
}
