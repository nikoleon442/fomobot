import { Token, MilestoneConfig, Group, CycleStats, HealthStatus } from '../../src/domain/types';

export const createMockToken = (overrides: Partial<Token> = {}): Token => ({
  id: BigInt(1),
  tokenAddress: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  initialMarketCapUsd: 1000000,
  firstCalledAtUtc: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

export const createMockMilestoneConfig = (overrides: Partial<MilestoneConfig> = {}): MilestoneConfig => ({
  id: BigInt(1),
  groupName: 'fsm',
  milestoneValue: 2,
  milestoneLabel: '2×',
  isActive: true,
  createdAtUtc: new Date(),
  updatedAtUtc: new Date(),
  ...overrides,
});

export const createMockCycleStats = (overrides: Partial<CycleStats> = {}): CycleStats => ({
  processed: 0,
  alertsSent: 0,
  skipped: 0,
  errors: 0,
  startTime: new Date(),
  ...overrides,
});

export const createMockHealthStatus = (overrides: Partial<HealthStatus> = {}): HealthStatus => ({
  status: 'healthy',
  uptime: 1000,
  provider: 'dexscreener',
  stats: createMockCycleStats(),
  ...overrides,
});

export const createMockTokens = (count: number, group: Group = 'fsm'): Token[] => {
  return Array.from({ length: count }, (_, index) => 
    createMockToken({
      id: BigInt(index + 1),
      symbol: `TOKEN${index + 1}`,
      tokenAddress: `Token${index + 1}Address`,
      initialMarketCapUsd: 1000000, // Set initial market cap for milestone calculations
    })
  );
};

export const createMockMilestoneConfigs = (group: Group = 'fsm'): MilestoneConfig[] => {
  return [
    createMockMilestoneConfig({ id: BigInt(1), groupName: group, milestoneValue: 2, milestoneLabel: '2×' }),
    createMockMilestoneConfig({ id: BigInt(2), groupName: group, milestoneValue: 3, milestoneLabel: '3×' }),
    createMockMilestoneConfig({ id: BigInt(3), groupName: group, milestoneValue: 5, milestoneLabel: '5×' }),
  ];
};
