import { MessageBuilder } from './message-builder';
import { Token, MilestoneConfig } from './types';

describe('MessageBuilder', () => {
  const mockToken: Token = {
    id: BigInt(1),
    tokenAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    initialMarketCapUsd: 1000000,
    firstCalledAtUtc: new Date('2024-01-01T00:00:00Z'),
  };

  const mockMilestone5x: MilestoneConfig = {
    id: BigInt(1),
    groupName: 'fsm',
    milestoneValue: 5,
    milestoneLabel: '5×',
    isActive: true,
    createdAtUtc: new Date(),
    updatedAtUtc: new Date(),
  };

  const mockMilestone2x: MilestoneConfig = {
    id: BigInt(2),
    groupName: 'fsm',
    milestoneValue: 2,
    milestoneLabel: '2×',
    isActive: true,
    createdAtUtc: new Date(),
    updatedAtUtc: new Date(),
  };

  const mockMilestone10x: MilestoneConfig = {
    id: BigInt(3),
    groupName: 'fsm',
    milestoneValue: 10,
    milestoneLabel: '10×',
    isActive: true,
    createdAtUtc: new Date(),
    updatedAtUtc: new Date(),
  };

  describe('buildMilestoneMessage', () => {
    it('should build FSM message format', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone5x, 5000000, 'fsm');

      expect(message).toContain('🚨 SOL just did a 5× since we called it in VIP group!');
      expect(message).toContain('We called it at a MarketCap of $1.00M');
      expect(message).toContain('It’s currently at $5.00M');
      expect(message).toContain('⏫And it’s still climbing!');
    });

    it('should build Issam message format', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone2x, 2000000, 'issam');

      expect(message).toContain('🔥وصلت');
      expect(message).toContain('SOL');
      expect(message).toContain('2×');
      expect(message).toContain('بعد ما نشرناها');
      expect(message).toContain('Initial MC: $1.00M');
      expect(message).toContain('Current MC: $2.00M');
      expect(message).toContain('Called: 2024-01-01T00:00:00.000Z');
    });

    it('should format large numbers correctly', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone10x, 1000000000, 'issam');
      
      expect(message).toContain('Current MC: $1.00B');
    });

    it('should format small numbers correctly', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone2x, 2500, 'issam');
      
      expect(message).toContain('Current MC: $2.50K');
    });
  });
});
