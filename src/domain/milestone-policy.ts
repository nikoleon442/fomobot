import { USD, Multiple, MilestoneConfig } from './types';

export class MilestonePolicy {
  constructor(private readonly milestones: MilestoneConfig[]) {
    // Sort milestones by value in ascending order
    this.milestones.sort((a, b) => a.milestoneValue - b.milestoneValue);
  }

  /**
   * Determines which milestones have been crossed based on current vs initial market cap
   * @param initialCap Initial market cap in USD
   * @param currentCap Current market cap in USD
   * @returns Array of crossed milestone configurations
   */
  crossed(initialCap: USD, currentCap: USD): MilestoneConfig[] {
    if (initialCap <= 0 || currentCap <= 0) {
      return [];
    }

    const ratio = currentCap / initialCap;
    return this.milestones.filter(milestone => ratio >= milestone.milestoneValue);
  }

  /**
   * Gets all configured milestones
   */
  getAllMilestones(): MilestoneConfig[] {
    return [...this.milestones];
  }

  /**
   * Checks if a specific milestone has been crossed
   */
  isMilestoneCrossed(initialCap: USD, currentCap: USD, milestone: MilestoneConfig): boolean {
    if (initialCap <= 0 || currentCap <= 0) {
      return false;
    }

    const ratio = currentCap / initialCap;
    return ratio >= milestone.milestoneValue;
  }

  /**
   * Calculates the current multiple (ratio) of market cap
   */
  calculateMultiple(initialCap: USD, currentCap: USD): number {
    if (initialCap <= 0) {
      return 0;
    }
    return currentCap / initialCap;
  }
}
