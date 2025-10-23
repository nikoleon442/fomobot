import { MilestonePolicy } from '../../../src/domain/milestone-policy';
import { MilestoneConfig } from '../../../src/domain/types';
import { createMockMilestoneConfig } from '../test-utils';

describe('MilestonePolicy', () => {
  let policy: MilestonePolicy;
  let mockMilestones: MilestoneConfig[];

  beforeEach(() => {
    mockMilestones = [
      createMockMilestoneConfig({ id: BigInt(1), milestoneValue: 2, milestoneLabel: '2×' }),
      createMockMilestoneConfig({ id: BigInt(2), milestoneValue: 3, milestoneLabel: '3×' }),
      createMockMilestoneConfig({ id: BigInt(3), milestoneValue: 5, milestoneLabel: '5×' }),
      createMockMilestoneConfig({ id: BigInt(4), milestoneValue: 10, milestoneLabel: '10×' }),
    ];
    policy = new MilestonePolicy(mockMilestones);
  });

  describe('crossed', () => {
    it('should return empty array when current cap is less than initial', () => {
      const result = policy.crossed(1000, 500);
      expect(result).toEqual([]);
    });

    it('should return milestones that have been crossed', () => {
      const result = policy.crossed(1000, 3500);
      expect(result).toHaveLength(2);
      expect(result[0].milestoneValue).toBe(2);
      expect(result[1].milestoneValue).toBe(3);
    });

    it('should return all milestones when ratio is very high', () => {
      const result = policy.crossed(1000, 15000);
      expect(result).toHaveLength(4);
      expect(result.map(m => m.milestoneValue)).toEqual([2, 3, 5, 10]);
    });

    it('should handle exact milestone crossings', () => {
      const result = policy.crossed(1000, 2000);
      expect(result).toHaveLength(1);
      expect(result[0].milestoneValue).toBe(2);
    });

    it('should return empty array for zero or negative values', () => {
      expect(policy.crossed(0, 1000)).toEqual([]);
      expect(policy.crossed(1000, 0)).toEqual([]);
      expect(policy.crossed(-1000, 1000)).toEqual([]);
      expect(policy.crossed(1000, -1000)).toEqual([]);
    });

    it('should handle edge case of zero initial cap', () => {
      const result = policy.crossed(0, 1000);
      expect(result).toEqual([]);
    });
  });

  describe('isMilestoneCrossed', () => {
    it('should return true when milestone is crossed', () => {
      const milestone2x = mockMilestones.find(m => m.milestoneValue === 2);
      expect(policy.isMilestoneCrossed(1000, 2000, milestone2x!)).toBe(true);
    });

    it('should return false when milestone is not crossed', () => {
      const milestone2x = mockMilestones.find(m => m.milestoneValue === 2);
      expect(policy.isMilestoneCrossed(1000, 1500, milestone2x!)).toBe(false);
    });

    it('should return false for zero or negative values', () => {
      const milestone2x = mockMilestones.find(m => m.milestoneValue === 2);
      expect(policy.isMilestoneCrossed(0, 1000, milestone2x!)).toBe(false);
      expect(policy.isMilestoneCrossed(1000, 0, milestone2x!)).toBe(false);
    });
  });

  describe('calculateMultiple', () => {
    it('should calculate correct multiple', () => {
      expect(policy.calculateMultiple(1000, 2500)).toBe(2.5);
    });

    it('should return 0 for zero initial cap', () => {
      expect(policy.calculateMultiple(0, 1000)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(policy.calculateMultiple(1000, -500)).toBe(-0.5);
    });
  });

  describe('getAllMilestones', () => {
    it('should return all milestones in ascending order', () => {
      const milestones = policy.getAllMilestones();
      expect(milestones).toHaveLength(4);
      expect(milestones.map(m => m.milestoneValue)).toEqual([2, 3, 5, 10]);
    });

    it('should return a copy of milestones', () => {
      const milestones1 = policy.getAllMilestones();
      const milestones2 = policy.getAllMilestones();
      expect(milestones1).not.toBe(milestones2);
      expect(milestones1).toEqual(milestones2);
    });
  });

  describe('constructor', () => {
    it('should sort milestones by value in ascending order', () => {
      const unsortedMilestones = [
        createMockMilestoneConfig({ milestoneValue: 10 }),
        createMockMilestoneConfig({ milestoneValue: 2 }),
        createMockMilestoneConfig({ milestoneValue: 5 }),
      ];
      
      const policy = new MilestonePolicy(unsortedMilestones);
      const sortedMilestones = policy.getAllMilestones();
      
      expect(sortedMilestones.map(m => m.milestoneValue)).toEqual([2, 5, 10]);
    });
  });
});
