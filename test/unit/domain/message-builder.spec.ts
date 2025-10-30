import { MessageBuilder } from '../../../src/domain/message-builder';
import { Token, MilestoneConfig } from '../../../src/domain/types';
import { createMockToken, createMockMilestoneConfig } from '../test-utils';

describe('MessageBuilder', () => {
  const mockToken: Token = createMockToken({
    id: BigInt(1),
    tokenAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    initialMarketCapUsd: 1000000,
    firstCalledAtUtc: new Date('2024-01-01T00:00:00Z'),
  });

  const mockMilestone5x: MilestoneConfig = createMockMilestoneConfig({
    id: BigInt(1),
    groupName: 'fsm',
    milestoneValue: 5,
    milestoneLabel: '5×',
  });

  const mockMilestone2x: MilestoneConfig = createMockMilestoneConfig({
    id: BigInt(2),
    groupName: 'fsm',
    milestoneValue: 2,
    milestoneLabel: '2×',
  });

  const mockMilestone10x: MilestoneConfig = createMockMilestoneConfig({
    id: BigInt(3),
    groupName: 'fsm',
    milestoneValue: 10,
    milestoneLabel: '10×',
  });

  describe('buildMilestoneMessage', () => {
    it('should build correct message format', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone5x, 5000000, 'issam');
      
      expect(message).toContain('صلت عملة SOL');
      expect(message).toContain('5×');
      expect(message).toContain('Initial MC: $1.00M');
      expect(message).toContain('Current MC: $5.00M');
      expect(message).toContain('Called: 2024-01-01T00:00:00.000Z');
      expect(message).toContain('خليك قريب');
    });

    it('should handle different milestone values', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone2x, 2000000, 'issam');
      
      expect(message).toContain('2×');
      expect(message).toContain('Current MC: $2.00M');
    });

    it('should format large numbers correctly', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone10x, 1000000000, 'issam');
      
      expect(message).toContain('Current MC: $1.00B');
    });

    it('should format small numbers correctly', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone2x, 2500, 'issam');
      
      expect(message).toContain('Current MC: $2.50K');
    });

    it('should handle very small numbers', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone2x, 100, 'issam');
      
      expect(message).toContain('Current MC: $100.00');
    });

    it('should handle billion dollar market caps', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone2x, 2500000000, 'issam');
      
      expect(message).toContain('Current MC: $2.50B');
    });

    it('should handle million dollar market caps', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone2x, 2500000, 'issam');
      
      expect(message).toContain('Current MC: $2.50M');
    });

    it('should handle thousand dollar market caps', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone2x, 2500, 'issam');
      
      expect(message).toContain('Current MC: $2.50K');
    });

    it('should include all required message components', () => {
      const message = MessageBuilder.buildMilestoneMessage(mockToken, mockMilestone5x, 5000000, 'issam');
      const lines = message.split('\n');
      
      expect(lines).toHaveLength(5);
      expect(lines[0]).toContain('SOL');
      expect(lines[0]).toContain('5×');
      expect(lines[1]).toContain('Initial MC:');
      expect(lines[2]).toContain('Current MC:');
      expect(lines[3]).toContain('Called:');
      expect(lines[4]).toContain('خليك قريب');
    });

    it('should handle different token symbols', () => {
      const customToken = createMockToken({ symbol: 'BTC' });
      const message = MessageBuilder.buildMilestoneMessage(customToken, mockMilestone2x, 2000000, 'issam');
      
      expect(message).toContain('BTC');
    });

    it('should handle different milestone labels', () => {
      const customMilestone = createMockMilestoneConfig({ milestoneLabel: '3×' });
      const message = MessageBuilder.buildMilestoneMessage(mockToken, customMilestone, 3000000, 'issam');
      
      expect(message).toContain('3×');
    });
  });
});
