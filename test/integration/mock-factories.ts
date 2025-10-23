import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { HttpService } from '@nestjs/axios';
import { SupabaseClient } from '@supabase/supabase-js';
import { TokenRepositoryPort } from '../../src/ports/token-repository.port';
import { MilestoneConfigRepositoryPort } from '../../src/ports/milestone-config-repository.port';
import { MilestoneNotificationRepositoryPort } from '../../src/ports/milestone-notification-repository.port';
import { NotifierPort } from '../../src/ports/notifier.port';
import { MarketCapProviderPort } from '../../src/ports/market-cap-provider.port';
import { ClockPort } from '../../src/ports/clock.port';
import { LoggerPort } from '../../src/ports/logger.port';
import { EnvConfig } from '../../src/adapters/system/env.config';

// Mock factories for external dependencies
export const mockHttpService = mockDeep<HttpService>();
export const mockSupabaseClient = mockDeep<SupabaseClient>();

// Mock factories for ports
export const mockTokenRepository = mockDeep<TokenRepositoryPort>();
export const mockMilestoneConfigRepository = mockDeep<MilestoneConfigRepositoryPort>();
export const mockMilestoneNotificationRepository = mockDeep<MilestoneNotificationRepositoryPort>();
export const mockNotifier = mockDeep<NotifierPort>();
export const mockMarketCapProvider = mockDeep<MarketCapProviderPort>();
export const mockClock = mockDeep<ClockPort>();
export const mockLogger = mockDeep<LoggerPort>();
export const mockEnvConfig = mockDeep<EnvConfig>();

// Reset all mocks before each test
export const resetAllMocks = () => {
  mockReset(mockHttpService);
  mockReset(mockSupabaseClient);
  mockReset(mockTokenRepository);
  mockReset(mockMilestoneConfigRepository);
  mockReset(mockMilestoneNotificationRepository);
  mockReset(mockNotifier);
  mockReset(mockMarketCapProvider);
  mockReset(mockClock);
  mockReset(mockLogger);
  mockReset(mockEnvConfig);
};

// Common mock implementations
export const setupCommonMocks = () => {
  mockClock.now.mockReturnValue(new Date('2024-01-01T00:00:00Z'));
  mockClock.timestamp.mockReturnValue(1704067200000);
  mockLogger.info.mockImplementation(() => {});
  mockLogger.warn.mockImplementation(() => {});
  mockLogger.error.mockImplementation(() => {});
  mockLogger.log.mockImplementation(() => {});
};
