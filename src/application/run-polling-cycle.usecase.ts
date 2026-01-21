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
  // Track consecutive milestone crossings in memory: Map<`${tokenId}-${milestoneValue}`, count>
  private consecutiveMilestoneCounts: Map<string, number> = new Map();
  // Track last known market caps for rate-of-change detection: Map<tokenAddress, { cap, timestamp }>
  private lastKnownCaps: Map<string, { cap: number; timestamp: Date }> = new Map();
  // Track last alert time per token for cooldown: Map<tokenId, lastAlertTime>
  private tokenAlertCooldowns: Map<string, Date> = new Map();

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

    // Validate market cap change is within acceptable bounds (rate-of-change guard)
    const validatedCap = this.validateMarketCapChange(token.tokenAddress, currentCap);
    if (validatedCap === null) {
      this.logger.warn(`Skipping token ${token.symbol} due to suspicious market cap change`, {
        tokenAddress: token.tokenAddress,
        reportedCap: currentCap,
      });
      this.currentStats.skipped++;
      return;
    }

    // Check if token is on cooldown from recent alert
    if (this.isTokenOnCooldown(token.id)) {
      this.logger.info(`Token ${token.symbol} is on alert cooldown, skipping milestone checks`, {
        tokenId: token.id.toString(),
        tokenAddress: token.tokenAddress,
      });
      return;
    }

    try {
      // Get all configured milestones - we need ALL to track consecutive counts
      const allMilestones = milestonePolicy.getAllMilestones();

      // Update consecutive counts and send alerts for all milestones in one pass
      for (const milestone of allMilestones) {
        const key = this.getMilestoneKey(token.id, milestone.milestoneValue);
        const isCrossed = milestonePolicy.isMilestoneCrossed(
          token.initialMarketCapUsd,
          validatedCap,
          milestone,
        );
        
        if (isCrossed) {
          // Increment consecutive count
          const currentCount = this.consecutiveMilestoneCounts.get(key) || 0;
          const newCount = currentCount + 1;
          this.consecutiveMilestoneCounts.set(key, newCount);
          this.logger.info(`Milestone ${milestone.milestoneLabel} crossed for ${token.symbol}, current market cap: ${validatedCap}, initial market cap: ${token.initialMarketCapUsd}, consecutive count: ${newCount}`, {
            tokenId: token.id.toString(),
            milestoneValue: milestone.milestoneValue,
            count: newCount,
          });

          // Send alert if threshold is met
          await this.sendMilestoneAlert(token, milestone, validatedCap, group);
        } else {
          // Reset count if milestone is not crossed (breaks consecutive streak)
          if (this.consecutiveMilestoneCounts.has(key)) {
            const previousCount = this.consecutiveMilestoneCounts.get(key);
            this.consecutiveMilestoneCounts.delete(key);
            this.logger.info(`Milestone ${milestone.milestoneLabel} not crossed for ${token.symbol}, resetting consecutive count (was ${previousCount})`, {
              tokenId: token.id.toString(),
              milestoneValue: milestone.milestoneValue,
              previousCount,
              currentMarketCap: validatedCap,
              initialMarketCap: token.initialMarketCapUsd,
            });
          }
        }
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
        // Reset consecutive count since it was already notified
        const key = this.getMilestoneKey(token.id, milestone.milestoneValue);
        this.consecutiveMilestoneCounts.delete(key);
        return;
      }

      // Check if milestone has been reached consecutively enough times
      const key = this.getMilestoneKey(token.id, milestone.milestoneValue);
      const consecutiveCount = this.consecutiveMilestoneCounts.get(key) || 0;
      const threshold = this.envConfig.milestoneConsecutiveThreshold;

      if (consecutiveCount < threshold) {
        this.logger.info(`Milestone ${milestone.milestoneLabel} crossed for ${token.symbol} but not enough consecutive times (${consecutiveCount}/${threshold})`, {
          tokenId: token.id.toString(),
          milestoneValue: milestone.milestoneValue,
          consecutiveCount,
          threshold,
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

      // Reset consecutive count after successful notification
      this.consecutiveMilestoneCounts.delete(key);

      // Record cooldown to prevent multiple alerts for this token in quick succession
      this.recordAlertForCooldown(token.id);

      this.currentStats.alertsSent++;
      this.logger.info(`Sent milestone alert for ${token.symbol}`, {
        milestoneLabel: milestone.milestoneLabel,
        milestoneValue: milestone.milestoneValue,
        group,
        tokenAddress: token.tokenAddress,
        consecutiveCount,
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

  private getMilestoneKey(tokenId: bigint, milestoneValue: number): string {
    return `${tokenId}-${milestoneValue}`;
  }

  /**
   * Checks if the market cap change since last poll is within acceptable bounds.
   * This protects against API returning wildly incorrect values.
   * Returns the validated cap or null if the change is suspicious.
   */
  private validateMarketCapChange(tokenAddress: string, newCap: number): number | null {
    const previous = this.lastKnownCaps.get(tokenAddress);
    const now = this.clock.now();

    // First time seeing this token - accept the value and store it
    if (!previous) {
      this.lastKnownCaps.set(tokenAddress, { cap: newCap, timestamp: now });
      return newCap;
    }

    const ratio = newCap / previous.cap;
    const maxChangeRatio = this.envConfig.maxCapChangeRatio;

    // Check if change is within acceptable bounds (both up and down)
    if (ratio > maxChangeRatio || ratio < 1 / maxChangeRatio) {
      this.logger.warn(`Suspicious market cap change detected, rejecting value`, {
        tokenAddress,
        previousCap: previous.cap,
        newCap,
        changeRatio: ratio.toFixed(2),
        maxAllowedRatio: maxChangeRatio,
        timeSinceLastPoll: now.getTime() - previous.timestamp.getTime(),
      });
      // Don't update stored cap - keep the last known good value
      return null;
    }

    // Valid change - update stored cap
    this.lastKnownCaps.set(tokenAddress, { cap: newCap, timestamp: now });
    return newCap;
  }

  /**
   * Checks if a token is still on cooldown from a recent alert.
   * Prevents spamming multiple milestone alerts for the same token.
   */
  private isTokenOnCooldown(tokenId: bigint): boolean {
    const lastAlert = this.tokenAlertCooldowns.get(tokenId.toString());
    if (!lastAlert) return false;

    const cooldownMs = this.envConfig.alertCooldownSeconds * 1000;
    const elapsed = this.clock.now().getTime() - lastAlert.getTime();
    return elapsed < cooldownMs;
  }

  /**
   * Records an alert timestamp for cooldown tracking.
   */
  private recordAlertForCooldown(tokenId: bigint): void {
    this.tokenAlertCooldowns.set(tokenId.toString(), this.clock.now());
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
