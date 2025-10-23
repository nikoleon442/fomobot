import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MarketCapProviderPort } from '../../ports/market-cap-provider.port';
import { Token, MarketCapData } from '../../domain/types';
import { EnvConfig } from '../system/env.config';

@Injectable()
export class CMCAdapter implements MarketCapProviderPort {
  private readonly baseUrl = 'https://pro-api.coinmarketcap.com/v1';
  private readonly batchSize = 100;

  constructor(
    private readonly httpService: HttpService,
    private readonly envConfig: EnvConfig,
  ) {}

  async getCaps(tokens: Token[]): Promise<MarketCapData> {
    const result: MarketCapData = {};
    
    // Process tokens in batches
    for (let i = 0; i < tokens.length; i += this.batchSize) {
      const batch = tokens.slice(i, i + this.batchSize);
      const batchResult = await this.fetchBatch(batch);
      Object.assign(result, batchResult);
    }

    return result;
  }

  private async fetchBatch(tokens: Token[]): Promise<MarketCapData> {
    try {
      const addresses = tokens.map(t => t.tokenAddress);
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/cryptocurrency/quotes/latest`, {
          params: {
            symbol: addresses.join(','),
            convert: 'USD',
          },
          headers: {
            'X-CMC_PRO_API_KEY': this.envConfig.cmcApiKey,
          },
        }),
      );

      const result: MarketCapData = {};
      
      tokens.forEach(token => {
        const coinData = response.data.data?.[token.tokenAddress];
        result[token.tokenAddress] = coinData?.quote?.USD?.market_cap || null;
      });

      return result;
    } catch (error) {
      console.error('CoinMarketCap API error:', error);
      // Return null for all tokens in case of error
      const result: MarketCapData = {};
      tokens.forEach(token => {
        result[token.tokenAddress] = null;
      });
      return result;
    }
  }

  getProviderName(): string {
    return 'CoinMarketCap';
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/key/info`, {
          headers: {
            'X-CMC_PRO_API_KEY': this.envConfig.cmcApiKey,
          },
        }),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
