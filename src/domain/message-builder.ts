import { Token, USD, MilestoneConfig, Group } from './types';

export class MessageBuilder {
  /**
   * Builds a Telegram message for milestone crossing
   */
  static buildMilestoneMessage(
    token: Token,
    milestone: MilestoneConfig,
    currentCap: USD,
    group: Group,
  ): string {
    const formattedInitial = this.formatUSD(token.initialMarketCapUsd);
    const formattedCurrent = this.formatUSD(currentCap);
    const calledAt = token.firstCalledAtUtc.toISOString();

    if (group === 'fsm') {
      return [
        `🚨 ${token.symbol} just did a ${milestone.milestoneLabel} since we called it in VIP group!`,
        `We called it at a MarketCap of $${formattedInitial}`,
        `It’s currently at $${formattedCurrent}`,
        `⏫And it’s still climbing!`,
        `Join VIP instantly so you don’t miss the next one!`,
        `20% off for the rest of this month!`,
        `https://buy.stripe.com/eVq6oG1INb5Sdgq1UK0ZW0a`,
      ].join('\n');
    }

    // issam
    return [
      `صلت عملة ${token.symbol} ل ${milestone.milestoneLabel} بعد ما نشرناها`,
      `Initial MC: $${formattedInitial}`,
      `Current MC: $${formattedCurrent}`,
      `Called: ${calledAt}`,
      `خليك قريب لتحصل على العملات اول ما يتم نشرها`,
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
