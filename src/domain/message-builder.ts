import { Token, USD, MilestoneConfig } from './types';

export class MessageBuilder {
  /**
   * Builds a Telegram message for milestone crossing
   */
  static buildMilestoneMessage(
    token: Token,
    milestone: MilestoneConfig,
    currentCap: USD,
  ): string {
    const formattedInitial = this.formatUSD(token.initialMarketCapUsd);
    const formattedCurrent = this.formatUSD(currentCap);
    const calledAt = token.firstCalledAtUtc.toISOString();

    return [
      `🚨 *${token.symbol}* hit *${milestone.milestoneLabel}* market cap since call-out!`,
      `Initial MC: $${formattedInitial}`,
      `Current MC: $${formattedCurrent}`,
      `Called: ${calledAt}`,
      `⏫ Still moving — watch closely.`,
    ].join('\n');
  }

  /**
   * Formats USD amounts with appropriate precision
   */
  private static formatUSD(amount: USD): string {
    if (amount >= 1_000_000_000) {
      return `${(amount / 1_000_000_000).toFixed(2)}B`;
    } else if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(2)}M`;
    } else if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(2)}K`;
    } else {
      return amount.toFixed(2);
    }
  }
}
