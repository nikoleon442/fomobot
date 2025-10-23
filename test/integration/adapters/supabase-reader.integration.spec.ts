import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseReader } from '../../../src/adapters/persistence/supabase-reader';
import { EnvConfig } from '../../../src/adapters/system/env.config';
import { createMockToken } from '../../unit/test-utils';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { createClient } from '@supabase/supabase-js';

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('SupabaseReader Integration', () => {
  let adapter: SupabaseReader;
  let mockEnvConfig: DeepMockProxy<EnvConfig>;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    mockEnvConfig = mockDeep<EnvConfig>();
    mockSupabaseClient = {
      from: jest.fn(),
    };

    // Mock createClient to return our mock
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    // Setup env config mocks
    Object.defineProperty(mockEnvConfig, 'supabaseUrl', {
      get: jest.fn().mockReturnValue('https://test.supabase.co'),
      configurable: true
    });
    Object.defineProperty(mockEnvConfig, 'supabaseServiceKey', {
      get: jest.fn().mockReturnValue('test-service-key'),
      configurable: true
    });
    Object.defineProperty(mockEnvConfig, 'supabaseTableFsm', {
      get: jest.fn().mockReturnValue('tokens_fsm'),
      configurable: true
    });
    Object.defineProperty(mockEnvConfig, 'supabaseTableIssam', {
      get: jest.fn().mockReturnValue('tokens_issam'),
      configurable: true
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseReader,
        {
          provide: EnvConfig,
          useValue: mockEnvConfig,
        },
      ],
    }).compile();

    adapter = module.get<SupabaseReader>(SupabaseReader);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listAll', () => {
    it('should fetch tokens from FSM table successfully', async () => {
      // Arrange
      const mockTokens = [
        {
          id: 1,
          token_address: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          initial_market_cap_usd: 1000000,
          first_called_at_utc: '2024-01-01T00:00:00Z',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockTokens,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      // Act
      const result = await adapter.listAll('fsm');

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tokens_fsm');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.order).toHaveBeenCalledWith('first_called_at_utc', { ascending: false });
      expect(mockQuery.limit).toHaveBeenCalledWith(100);
      expect(result).toHaveLength(1);
      expect(result[0].tokenAddress).toBe('So11111111111111111111111111111111111111112');
      expect(result[0].symbol).toBe('SOL');
    });

    it('should fetch tokens from Issam table successfully', async () => {
      // Arrange
      const mockTokens = [
        {
          id: 2,
          token_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          symbol: 'USDC',
          initial_market_cap_usd: 500000,
          first_called_at_utc: '2024-01-01T00:00:00Z',
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockTokens,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      // Act
      const result = await adapter.listAll('issam');

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tokens_issam');
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('USDC');
    });

    it('should handle database errors', async () => {
      // Arrange
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Table not found' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      // Act & Assert
      await expect(adapter.listAll('fsm')).rejects.toThrow('Database error: Failed to fetch tokens from tokens_fsm');
    });

    it('should handle empty results', async () => {
      // Arrange
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      // Act
      const result = await adapter.listAll('fsm');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('isHealthy', () => {
    it('should return true when database is accessible', async () => {
      // Arrange
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ id: 1 }],
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tokens_fsm');
    });

    it('should return false when database is not accessible', async () => {
      // Arrange
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection failed' },
        }),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when query throws an error', async () => {
      // Arrange
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Network error')),
      };

      mockSupabaseClient.from.mockReturnValue(mockQuery);

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should initialize Supabase client with correct configuration', () => {
      // Assert
      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key'
      );
    });

    it('should throw configuration error on invalid Supabase URL', () => {
      // Arrange
      const invalidEnvConfig = mockDeep<EnvConfig>();
      Object.defineProperty(invalidEnvConfig, 'supabaseUrl', {
        get: jest.fn().mockReturnValue(''),
        configurable: true
      });
      Object.defineProperty(invalidEnvConfig, 'supabaseServiceKey', {
        get: jest.fn().mockReturnValue('test-key'),
        configurable: true
      });
      Object.defineProperty(invalidEnvConfig, 'supabaseTableFsm', {
        get: jest.fn().mockReturnValue('tokens_fsm'),
        configurable: true
      });
      Object.defineProperty(invalidEnvConfig, 'supabaseTableIssam', {
        get: jest.fn().mockReturnValue('tokens_issam'),
        configurable: true
      });

      // Act & Assert
      expect(() => {
        new SupabaseReader(invalidEnvConfig);
      }).toThrow('Configuration error: Failed to initialize Supabase client');
    });
  });
});
