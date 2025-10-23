import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { DexScreenerAdapter } from '../../../src/adapters/providers/dexscreener.adapter';
import { createMockToken } from '../../unit/test-utils';
import { of, throwError } from 'rxjs';

describe('DexScreenerAdapter Integration', () => {
  let adapter: DexScreenerAdapter;
  let httpService: any;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DexScreenerAdapter,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    adapter = module.get<DexScreenerAdapter>(DexScreenerAdapter);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCaps', () => {
    it('should fetch market cap data for single token', async () => {
      // Arrange
      const tokens = [createMockToken({ tokenAddress: 'So11111111111111111111111111111111111111112' })];
      const mockResponse = {
        data: [
          {
            baseToken: {
              address: 'So11111111111111111111111111111111111111112',
            },
            fdv: '1000000000',
            marketCap: '950000000',
          },
        ],
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.getCaps(tokens);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112'
      );
      expect(result).toEqual({
        'So11111111111111111111111111111111111111112': 1000000000,
      });
    });

    it('should fetch market cap data for multiple tokens in batches', async () => {
      // Arrange
      const tokens = Array.from({ length: 35 }, (_, i) => 
        createMockToken({ 
          tokenAddress: `Token${i}Address`,
          symbol: `TOKEN${i}`,
        })
      );

      const mockResponse = {
        data: tokens.map((token, i) => ({
          baseToken: {
            address: token.tokenAddress,
          },
          fdv: `${1000000 * (i + 1)}`,
        })),
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.getCaps(tokens);

      // Assert
      expect(httpService.get).toHaveBeenCalledTimes(2); // 35 tokens = 2 batches (30 + 5)
      expect(Object.keys(result)).toHaveLength(35);
      expect(result['Token0Address']).toBe(1000000);
      expect(result['Token34Address']).toBe(35000000);
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const tokens = [createMockToken()];
      httpService.get.mockReturnValue(throwError(() => new Error('API rate limit exceeded')));

      // Act
      const result = await adapter.getCaps(tokens);

      // Assert
      expect(result).toEqual({
        [tokens[0].tokenAddress]: null,
      });
    });

    it('should handle empty API response', async () => {
      // Arrange
      const tokens = [createMockToken()];
      const mockResponse = { data: [] };
      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.getCaps(tokens);

      // Assert
      expect(result).toEqual({
        [tokens[0].tokenAddress]: null,
      });
    });

    it('should prefer fdv over marketCap when both are available', async () => {
      // Arrange
      const tokens = [createMockToken()];
      const mockResponse = {
        data: [
          {
            baseToken: {
              address: tokens[0].tokenAddress,
            },
            fdv: '1000000000',
            marketCap: '950000000',
          },
        ],
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.getCaps(tokens);

      // Assert
      expect(result[tokens[0].tokenAddress]).toBe(1000000000);
    });

    it('should use marketCap when fdv is not available', async () => {
      // Arrange
      const tokens = [createMockToken()];
      const mockResponse = {
        data: [
          {
            baseToken: {
              address: tokens[0].tokenAddress,
            },
            marketCap: '950000000',
          },
        ],
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.getCaps(tokens);

      // Assert
      expect(result[tokens[0].tokenAddress]).toBe(950000000);
    });

    it('should handle tokens with no market cap data', async () => {
      // Arrange
      const tokens = [createMockToken()];
      const mockResponse = {
        data: [
          {
            baseToken: {
              address: tokens[0].tokenAddress,
            },
            // No fdv or marketCap
          },
        ],
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.getCaps(tokens);

      // Assert
      expect(result[tokens[0].tokenAddress]).toBeNull();
    });
  });

  describe('getProviderName', () => {
    it('should return correct provider name', () => {
      // Act
      const name = adapter.getProviderName();

      // Assert
      expect(name).toBe('DexScreener');
    });
  });

  describe('isHealthy', () => {
    it('should return true when API is accessible', async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        data: {
          pairs: [
            {
              baseToken: { address: 'So11111111111111111111111111111111111111112' },
              fdv: '1000000000',
            },
          ],
        },
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112'
      );
    });

    it('should return false when API is not accessible', async () => {
      // Arrange
      httpService.get.mockReturnValue(throwError(() => new Error('Network error')));

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when API returns non-200 status', async () => {
      // Arrange
      const mockResponse = {
        status: 500,
        data: { error: 'Internal server error' },
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(false);
    });
  });
});
