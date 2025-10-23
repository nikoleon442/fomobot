import { MilestonePolicy } from './milestone-policy';
import { MilestoneConfig } from './types';

describe('MilestonePolicy', () => {
  let policy: MilestonePolicy;
  let mockMilestones: MilestoneConfig[];

  beforeEach(() => {
    mockMilestones = [
      { id: BigInt(1), groupName: 'fsm', milestoneValue: 2, milestoneLabel: '2×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
      { id: BigInt(2), groupName: 'fsm', milestoneValue: 3, milestoneLabel: '3×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
      { id: BigInt(3), groupName: 'fsm', milestoneValue: 4, milestoneLabel: '4×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
      { id: BigInt(4), groupName: 'fsm', milestoneValue: 5, milestoneLabel: '5×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
      { id: BigInt(5), groupName: 'fsm', milestoneValue: 6, milestoneLabel: '6×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
      { id: BigInt(6), groupName: 'fsm', milestoneValue: 7, milestoneLabel: '7×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
      { id: BigInt(7), groupName: 'fsm', milestoneValue: 8, milestoneLabel: '8×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
      { id: BigInt(8), groupName: 'fsm', milestoneValue: 9, milestoneLabel: '9×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
      { id: BigInt(9), groupName: 'fsm', milestoneValue: 10, milestoneLabel: '10×', isActive: true, createdAtUtc: new Date(), updatedAtUtc: new Date() },
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
      expect(result).toHaveLength(9);
      expect(result.map(m => m.milestoneValue)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
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
  });

  describe('calculateMultiple', () => {
    it('should calculate correct multiple', () => {
      expect(policy.calculateMultiple(1000, 2500)).toBe(2.5);
    });

    it('should return 0 for zero initial cap', () => {
      expect(policy.calculateMultiple(0, 1000)).toBe(0);
    });
  });

  describe('getAllMilestones', () => {
    it('should return all milestones in ascending order', () => {
      const milestones = policy.getAllMilestones();
      expect(milestones).toHaveLength(9);
      expect(milestones.map(m => m.milestoneValue)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
});
