export type TokenId = string;
export type USD = number;
export type Multiple = number;
export type Group = 'fsm' | 'issam';

export interface Token {
  id: bigint;
  tokenAddress: TokenId;
  symbol: string;
  initialMarketCapUsd: USD;
  firstCalledAtUtc: Date;
}

export interface MarketCapData {
  [tokenAddress: string]: USD | null;
}

export interface CycleStats {
  processed: number;
  alertsSent: number;
  skipped: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCycleAt?: Date;
  provider: string;
  stats: CycleStats;
}

export interface MilestoneConfig {
  id: bigint;
  groupName: Group;
  milestoneValue: Multiple;
  milestoneLabel: string;
  isActive: boolean;
  createdAtUtc: Date;
  updatedAtUtc: Date;
  createdBy?: string;
  notes?: string;
}

export interface MilestoneNotification {
  id?: bigint;
  tokenId: bigint;
  tokenAddress: string;
  groupName: Group;
  milestoneValue: Multiple;
  milestoneLabel: string;
  notifiedAtUtc: Date;
  messageId?: string;
}
