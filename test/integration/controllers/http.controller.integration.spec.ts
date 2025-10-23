import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AppController } from '../../../src/interface/http.controller';
import { GetHealthStatusUseCase } from '../../../src/application/get-health.usecase';
import { SchedulerService } from '../../../src/interface/scheduler.service';
import { createMockHealthStatus, createMockCycleStats } from '../../unit/test-utils';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('AppController Integration', () => {
  let controller: AppController;
  let mockHealthStatus: DeepMockProxy<GetHealthStatusUseCase>;
  let mockScheduler: DeepMockProxy<SchedulerService>;

  beforeEach(async () => {
    mockHealthStatus = mockDeep<GetHealthStatusUseCase>();
    mockScheduler = mockDeep<SchedulerService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: GetHealthStatusUseCase,
          useValue: mockHealthStatus,
        },
        {
          provide: SchedulerService,
          useValue: mockScheduler,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return health status successfully', async () => {
      // Arrange
      const mockHealth = createMockHealthStatus({
        status: 'healthy',
        uptime: 1000,
        lastCycleAt: new Date('2024-01-01T00:00:00Z'),
        provider: 'dexscreener',
        stats: createMockCycleStats({
          processed: 10,
          alertsSent: 2,
          skipped: 1,
          errors: 0,
        }),
      });

      mockHealthStatus.execute.mockResolvedValue(mockHealth);

      // Act
      const result = await controller.getHealth();

      // Assert
      expect(result).toEqual({
        status: 'healthy',
        uptime: 1000,
        lastCycleAt: '2024-01-01T00:00:00.000Z',
        provider: 'dexscreener',
        stats: {
          processed: 10,
          alertsSent: 2,
          skipped: 1,
          errors: 0,
          startTime: mockHealth.stats.startTime.toISOString(),
          endTime: mockHealth.stats.endTime?.toISOString(),
          duration: mockHealth.stats.duration,
        },
      });
    });

    it('should handle health check failure', async () => {
      // Arrange
      mockHealthStatus.execute.mockRejectedValue(new Error('Health check failed'));

      // Act & Assert
      await expect(controller.getHealth()).rejects.toThrow();
    });

    it('should handle degraded status', async () => {
      // Arrange
      const mockHealth = createMockHealthStatus({
        status: 'degraded',
        uptime: 2000,
        provider: 'coingecko',
      });

      mockHealthStatus.execute.mockResolvedValue(mockHealth);

      // Act
      const result = await controller.getHealth();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.provider).toBe('coingecko');
    });

    it('should handle unhealthy status', async () => {
      // Arrange
      const mockHealth = createMockHealthStatus({
        status: 'unhealthy',
        uptime: 3000,
        provider: 'birdeye',
      });

      mockHealthStatus.execute.mockResolvedValue(mockHealth);

      // Act
      const result = await controller.getHealth();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.provider).toBe('birdeye');
    });
  });

  describe('getStats', () => {
    it('should return cycle stats successfully', async () => {
      // Arrange
      const mockHealth = createMockHealthStatus({
        stats: createMockCycleStats({
          processed: 15,
          alertsSent: 3,
          skipped: 2,
          errors: 1,
        }),
      });

      mockHealthStatus.execute.mockResolvedValue(mockHealth);

      // Act
      const result = await controller.getStats();

      // Assert
      expect(result).toEqual(mockHealth.stats);
    });

    it('should handle stats retrieval failure', async () => {
      // Arrange
      mockHealthStatus.execute.mockRejectedValue(new Error('Stats retrieval failed'));

      // Act & Assert
      await expect(controller.getStats()).rejects.toThrow();
    });
  });

  describe('triggerManualCycle', () => {
    it('should trigger manual cycle successfully', async () => {
      // Arrange
      mockScheduler.isCycleRunning.mockReturnValue(false);
      mockScheduler.triggerManualCycle.mockResolvedValue();

      // Act
      const result = await controller.triggerManualCycle();

      // Assert
      expect(result).toEqual({
        message: 'Manual polling cycle triggered successfully',
        success: true,
      });
      expect(mockScheduler.triggerManualCycle).toHaveBeenCalledTimes(1);
    });

    it('should return error when cycle is already running', async () => {
      // Arrange
      mockScheduler.isCycleRunning.mockReturnValue(true);

      // Act
      const result = await controller.triggerManualCycle();

      // Assert
      expect(result).toEqual({
        message: 'Polling cycle is already running',
        success: false,
      });
      expect(mockScheduler.triggerManualCycle).not.toHaveBeenCalled();
    });

    it('should handle trigger failure', async () => {
      // Arrange
      mockScheduler.isCycleRunning.mockReturnValue(false);
      mockScheduler.triggerManualCycle.mockRejectedValue(new Error('Trigger failed'));

      // Act & Assert
      await expect(controller.triggerManualCycle()).rejects.toThrow();
    });
  });

  describe('getRoot', () => {
    it('should return root information', () => {
      // Act
      const result = controller.getRoot();

      // Assert
      expect(result).toEqual({
        message: 'FOMObot - Token Market Cap Monitoring Service',
        version: '1.0.0',
      });
    });
  });

  describe('error handling', () => {
    it('should handle validation errors in health endpoint', async () => {
      // Arrange
      mockHealthStatus.execute.mockRejectedValue(new Error('Validation failed'));

      // Act & Assert
      await expect(controller.getHealth()).rejects.toThrow();
    });

    it('should handle network errors in stats endpoint', async () => {
      // Arrange
      mockHealthStatus.execute.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(controller.getStats()).rejects.toThrow();
    });

    it('should handle service unavailable in trigger endpoint', async () => {
      // Arrange
      mockScheduler.isCycleRunning.mockReturnValue(false);
      mockScheduler.triggerManualCycle.mockRejectedValue(new Error('Service unavailable'));

      // Act & Assert
      await expect(controller.triggerManualCycle()).rejects.toThrow();
    });
  });
});
