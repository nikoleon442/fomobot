import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MarketCapProviderPort } from '../../ports/market-cap-provider.port';
import { Token, MarketCapData } from '../../domain/types';
import { ErrorHandler } from '../../domain/errors/error-handler';
import { EnvConfig } from '../system/env.config';

type GeckoTerminalSimpleTokenPriceResponse = {
  data?: {
    type?: string;
    attributes?: {
      token_prices?: Record<string, string>;
      market_cap_usd?: Record<string, string | null>;
    };
  };
};

@Injectable()
export class GeckoTerminalAdapter implements MarketCapProviderPort {
  private readonly logger = new Logger(GeckoTerminalAdapter.name);
  private readonly baseUrl = 'https://api.geckoterminal.com/api/v2';
  private readonly batchSize = 30; // documented limit for address batches

  constructor(
    private readonly httpService: HttpService,
    private readonly envConfig: EnvConfig,
  ) {}

  async getCaps(tokens: Token[]): Promise<MarketCapData> {
    const result: MarketCapData = {};

    for (let i = 0; i < tokens.length; i += this.batchSize) {
      const batch = tokens.slice(i, i + this.batchSize);
      const batchResult = await this.fetchBatch(batch);
      Object.assign(result, batchResult);
    }

    return result;
  }

  private async fetchBatch(tokens: Token[]): Promise<MarketCapData> {
    const result: MarketCapData = {};

    // Initialize all tokens with null (not found)
    tokens.forEach((t) => {
      result[t.tokenAddress] = null;
    });

    try {
      const addresses = tokens.map((t) => t.tokenAddress).join(',');
      const network = this.envConfig.geckoTerminalNetwork;

      console.log('addresses', `${this.baseUrl}/simple/networks/${network}/token_price/${addresses}`);
      const response = await firstValueFrom(
        this.httpService.get<GeckoTerminalSimpleTokenPriceResponse>(
          `${this.baseUrl}/simple/networks/${network}/token_price/${addresses}`,
          {
            params: {
              include_market_cap: true,
              // When mcap is missing/unverified, fall back to FDV.
              // (GeckoTerminal uses this short param name.)
              mcap_fdv_fallback: true,
            },
          },
        ),
      );

      const marketCaps = response.data?.data?.attributes?.market_cap_usd ?? {};

      tokens.forEach((t) => {
        const raw = marketCaps[t.tokenAddress];
        if (raw == null) {
          result[t.tokenAddress] = null;
          return;
        }
        const parsed = typeof raw === 'string' ? parseFloat(raw) : NaN;
        result[t.tokenAddress] = Number.isFinite(parsed) ? parsed : null;
      });
    } catch (error) {
      const applicationError = ErrorHandler.handle(error, {
        service: 'GeckoTerminal',
        operation: 'fetchBatch',
        tokenCount: tokens.length,
      });

      // Log error but don't throw - keep null values for all tokens
      this.logger.warn(`GeckoTerminal API error: ${applicationError.message}`, {
        error: applicationError.message,
        tokenCount: tokens.length,
      });
    }

    return result;
  }

  getProviderName(): string {
    return 'GeckoTerminal';
  }

  async isHealthy(): Promise<boolean> {
    try {
      const network = this.envConfig.geckoTerminalNetwork;
      // Wrapped SOL (works on solana network)
      const probe = 'So11111111111111111111111111111111111111112';

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/simple/networks/${network}/token_price/${probe}`, {
          params: {
            include_market_cap: true,
            mcap_fdv_fallback: true,
          },
        }),
      );

      return response.status === 200;
    } catch {
      return false;
    }
  }
}
