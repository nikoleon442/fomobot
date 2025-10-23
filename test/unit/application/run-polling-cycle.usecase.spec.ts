import { Test, TestingModule } from '@nestjs/testing';
import { RunPollingCycleUseCase } from '../../../src/application/run-polling-cycle.usecase';
import { MarketCapProviderFactory } from '../../../src/adapters/providers/provider.factory';
import { TokenRepositoryPort } from '../../../src/ports/token-repository.port';
import { MilestoneConfigRepositoryPort } from '../../../src/ports/milestone-config-repository.port';
import { MilestoneNotificationRepositoryPort } from '../../../src/ports/milestone-notification-repository.port';
import { NotifierPort } from '../../../src/ports/notifier.port';
import { ClockPort } from '../../../src/ports/clock.port';
import { LoggerPort } from '../../../src/ports/logger.port';
import { EnvConfig } from '../../../src/adapters/system/env.config';
import { MarketCapProviderPort } from '../../../src/ports/market-cap-provider.port';
import { createMockToken, createMockMilestoneConfig, createMockTokens } from '../test-utils';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('RunPollingCycleUseCase', () => {
  let useCase: RunPollingCycleUseCase;
  let mockTokenRepository: DeepMockProxy<TokenRepositoryPort>;
  let mockMilestoneConfigRepository: DeepMockProxy<MilestoneConfigRepositoryPort>;
  let mockMilestoneNotificationRepository: DeepMockProxy<MilestoneNotificationRepositoryPort>;
  let mockNotifier: DeepMockProxy<NotifierPort>;
  let mockClock: DeepMockProxy<ClockPort>;
  let mockLogger: DeepMockProxy<LoggerPort>;
  let mockMarketCapProvider: DeepMockProxy<MarketCapProviderPort>;
  let mockProviderFactory: DeepMockProxy<MarketCapProviderFactory>;
  let mockEnvConfig: DeepMockProxy<EnvConfig>;

  beforeEach(async () => {
    // Create fresh mocks for each test
    mockTokenRepository = {
      listAll: jest.fn(),
      isHealthy: jest.fn(),
    } as any;
    
    mockMilestoneConfigRepository = {
      getActiveMilestones: jest.fn(),
      isHealthy: jest.fn(),
    } as any;
    
    mockMilestoneNotificationRepository = {
      wasNotified: jest.fn(),
      recordNotification: jest.fn(),
      isHealthy: jest.fn(),
    } as any;
    
    mockNotifier = {
      send: jest.fn(),
      isHealthy: jest.fn(),
    } as any;
    
    mockClock = {
      now: jest.fn().mockReturnValue(new Date('2024-01-01T00:00:00Z')),
    } as any;
    
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;
    
    mockMarketCapProvider = {
      getCaps: jest.fn(),
      getProviderName: jest.fn(),
      isHealthy: jest.fn(),
    } as any;
    
    mockProviderFactory = {
      getProvider: jest.fn().mockReturnValue(mockMarketCapProvider),
    } as any;
    
    mockEnvConfig = mockDeep<EnvConfig>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunPollingCycleUseCase,
        {
          provide: 'TokenRepositoryPort',
          useValue: mockTokenRepository,
        },
        {
          provide: 'MilestoneConfigRepositoryPort',
          useValue: mockMilestoneConfigRepository,
        },
        {
          provide: 'MilestoneNotificationRepositoryPort',
          useValue: mockMilestoneNotificationRepository,
        },
        {
          provide: 'NotifierPort',
          useValue: mockNotifier,
        },
        {
          provide: 'ClockPort',
          useValue: mockClock,
        },
        {
          provide: 'LoggerPort',
          useValue: mockLogger,
        },
        {
          provide: MarketCapProviderFactory,
          useValue: mockProviderFactory,
        },
        {
          provide: EnvConfig,
          useValue: mockEnvConfig,
        },
      ],
    }).compile();

    useCase = module.get<RunPollingCycleUseCase>(RunPollingCycleUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should process both groups successfully', async () => {
      // Arrange
      const fsmTokens = createMockTokens(2, 'fsm');
      const issamTokens = createMockTokens(2, 'issam');
      const fsmMilestones = [createMockMilestoneConfig({ groupName: 'fsm', milestoneValue: 2 })];
      const issamMilestones = [createMockMilestoneConfig({ groupName: 'issam', milestoneValue: 2 })];
      
      (mockMilestoneConfigRepository.getActiveMilestones as jest.Mock)
        .mockResolvedValueOnce(fsmMilestones)
        .mockResolvedValueOnce(issamMilestones);
      
      (mockTokenRepository.listAll as jest.Mock)
        .mockResolvedValueOnce(fsmTokens)
        .mockResolvedValueOnce(issamTokens);
      
      // Mock market cap data for both groups - ensure milestones are crossed
      (mockMarketCapProvider.getCaps as jest.Mock)
        .mockResolvedValueOnce({
          [fsmTokens[0].tokenAddress]: 2000000, // 2x milestone crossed
          [fsmTokens[1].tokenAddress]: 2000000, // 2x milestone crossed
        })
        .mockResolvedValueOnce({
          [issamTokens[0].tokenAddress]: 2000000, // 2x milestone crossed
          [issamTokens[1].tokenAddress]: 2000000, // 2x milestone crossed
        });
      
      (mockMilestoneNotificationRepository.wasNotified as jest.Mock).mockResolvedValue(false);
      (mockNotifier.send as jest.Mock).mockResolvedValue(undefined);
      (mockMilestoneNotificationRepository.recordNotification as jest.Mock).mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute();

      // Assert
      expect(mockMilestoneConfigRepository.getActiveMilestones).toHaveBeenCalledWith('fsm');
      expect(mockMilestoneConfigRepository.getActiveMilestones).toHaveBeenCalledWith('issam');
      expect(mockTokenRepository.listAll).toHaveBeenCalledWith('fsm');
      expect(mockTokenRepository.listAll).toHaveBeenCalledWith('issam');
      expect(mockMarketCapProvider.getCaps).toHaveBeenCalledTimes(2);
      
      expect(result.processed).toBe(4); // 2 tokens from each group
      expect(result.alertsSent).toBe(4); // 2 alerts per group (2x milestone crossed for each of 2 tokens)
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockNotifier.send).toHaveBeenCalledTimes(4);
    });

    it('should handle no active milestones', async () => {
      // Arrange
      mockMilestoneConfigRepository.getActiveMilestones
        .mockResolvedValueOnce([]) // FSM group
        .mockResolvedValueOnce([]); // Issam group

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.processed).toBe(0);
      expect(result.alertsSent).toBe(0);
      expect(mockTokenRepository.listAll).not.toHaveBeenCalled();
    });

    it('should handle no tokens found', async () => {
      // Arrange
      const milestones = [createMockMilestoneConfig({ groupName: 'fsm', milestoneValue: 2 })];
      
      mockMilestoneConfigRepository.getActiveMilestones
        .mockResolvedValueOnce(milestones) // FSM group
        .mockResolvedValueOnce(milestones); // Issam group
      
      mockTokenRepository.listAll
        .mockResolvedValueOnce([]) // FSM group
        .mockResolvedValueOnce([]); // Issam group

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.processed).toBe(0);
      expect(result.alertsSent).toBe(0);
    });

    it('should handle market cap data not found', async () => {
      // Arrange
      const fsmTokens = createMockTokens(1, 'fsm');
      const issamTokens = createMockTokens(1, 'issam');
      const fsmMilestones = [createMockMilestoneConfig({ groupName: 'fsm', milestoneValue: 2 })];
      const issamMilestones = [createMockMilestoneConfig({ groupName: 'issam', milestoneValue: 2 })];
      
      mockMilestoneConfigRepository.getActiveMilestones
        .mockImplementation((group: string) => {
          if (group === 'fsm') return Promise.resolve(fsmMilestones);
          if (group === 'issam') return Promise.resolve(issamMilestones);
          return Promise.resolve([]);
        });
      
      mockTokenRepository.listAll
        .mockImplementation((group: string) => {
          if (group === 'fsm') return Promise.resolve(fsmTokens);
          if (group === 'issam') return Promise.resolve(issamTokens);
          return Promise.resolve([]);
        });
      
      mockMarketCapProvider.getCaps
        .mockImplementation((tokens: any[]) => {
          const result: any = {};
          tokens.forEach(token => {
            result[token.tokenAddress] = null; // No data found
          });
          return Promise.resolve(result);
        });

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.processed).toBe(2);
      expect(result.skipped).toBe(2);
      expect(result.alertsSent).toBe(0);
    });

    it('should handle already notified milestones', async () => {
      // Arrange
      const fsmTokens = createMockTokens(1, 'fsm');
      const issamTokens = createMockTokens(1, 'issam');
      const fsmMilestones = [createMockMilestoneConfig({ groupName: 'fsm', milestoneValue: 2 })];
      const issamMilestones = [createMockMilestoneConfig({ groupName: 'issam', milestoneValue: 2 })];
      
      mockMilestoneConfigRepository.getActiveMilestones
        .mockImplementation((group: string) => {
          if (group === 'fsm') return Promise.resolve(fsmMilestones);
          if (group === 'issam') return Promise.resolve(issamMilestones);
          return Promise.resolve([]);
        });
      
      mockTokenRepository.listAll
        .mockImplementation((group: string) => {
          if (group === 'fsm') return Promise.resolve(fsmTokens);
          if (group === 'issam') return Promise.resolve(issamTokens);
          return Promise.resolve([]);
        });
      
      mockMarketCapProvider.getCaps
        .mockImplementation((tokens: any[]) => {
          const result: any = {};
          tokens.forEach(token => {
            result[token.tokenAddress] = 2000000;
          });
          return Promise.resolve(result);
        });
      
      mockMilestoneNotificationRepository.wasNotified.mockResolvedValue(true); // Already notified

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.processed).toBe(2);
      expect(result.alertsSent).toBe(0);
      expect(mockNotifier.send).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockMilestoneConfigRepository.getActiveMilestones
        .mockRejectedValueOnce(new Error('Database error')) // FSM group fails
        .mockResolvedValueOnce([]); // Issam group succeeds

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.errors).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing group fsm',
        { error: 'Database error' }
      );
    });

    it('should handle notification sending failure', async () => {
      // Arrange
      const fsmTokens = createMockTokens(1, 'fsm');
      const issamTokens = createMockTokens(1, 'issam');
      const fsmMilestones = [createMockMilestoneConfig({ groupName: 'fsm', milestoneValue: 2 })];
      const issamMilestones = [createMockMilestoneConfig({ groupName: 'issam', milestoneValue: 2 })];
      
      mockMilestoneConfigRepository.getActiveMilestones
        .mockImplementation((group: string) => {
          if (group === 'fsm') return Promise.resolve(fsmMilestones);
          if (group === 'issam') return Promise.resolve(issamMilestones);
          return Promise.resolve([]);
        });
      
      mockTokenRepository.listAll
        .mockImplementation((group: string) => {
          if (group === 'fsm') return Promise.resolve(fsmTokens);
          if (group === 'issam') return Promise.resolve(issamTokens);
          return Promise.resolve([]);
        });
      
      mockMarketCapProvider.getCaps
        .mockImplementation((tokens: any[]) => {
          const result: any = {};
          tokens.forEach(token => {
            result[token.tokenAddress] = 2000000;
          });
          return Promise.resolve(result);
        });
      
      mockMilestoneNotificationRepository.wasNotified.mockResolvedValue(false);
      mockNotifier.send.mockRejectedValue(new Error('Telegram API error'));

      // Act
      const result = await useCase.execute();

      // Assert
      expect(result.processed).toBe(2);
      expect(result.errors).toBe(2); // Both groups fail to send notification
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send milestone alert for TOKEN1',
        expect.objectContaining({
          error: 'Telegram API error',
        })
      );
    });
  });

  describe('getCurrentStats', () => {
    it('should return current stats', () => {
      // Act
      const stats = useCase.getCurrentStats();

      // Assert
      expect(stats.processed).toBe(0);
      expect(stats.alertsSent).toBe(0);
      expect(stats.skipped).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.startTime).toBeDefined();
      expect(stats.endTime).toBeUndefined();
      expect(stats.duration).toBeUndefined();
    });
  });
});
