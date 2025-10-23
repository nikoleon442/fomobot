import { MilestoneConfig, Group } from '../domain/types';

export interface MilestoneConfigRepositoryPort {
  getActiveMilestones(group: Group): Promise<MilestoneConfig[]>;
  getMilestoneConfig(id: bigint): Promise<MilestoneConfig | null>;
  createMilestoneConfig(config: Omit<MilestoneConfig, 'id' | 'createdAtUtc' | 'updatedAtUtc'>): Promise<MilestoneConfig>;
  updateMilestoneConfig(id: bigint, updates: Partial<MilestoneConfig>): Promise<MilestoneConfig>;
  deactivateMilestoneConfig(id: bigint): Promise<void>;
}
