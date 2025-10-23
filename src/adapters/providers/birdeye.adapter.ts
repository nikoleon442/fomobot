import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MarketCapProviderPort } from '../../ports/market-cap-provider.port';
import { Token, MarketCapData } from '../../domain/types';
import { EnvConfig } from '../system/env.config';

@Injectable()
export class BirdeyeAdapter implements MarketCapProviderPort {
  private readonly baseUrl = 'https://public-api.birdeye.so/public';
  private readonly batchSize = 50; // Birdeye has different limits

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
        this.httpService.get(`${this.baseUrl}/v1/tokenlist`, {
          params: {
            address: addresses.join(','),
          },
          headers: {
            'X-API-KEY': this.envConfig.birdeyeApiKey,
          },
        }),
      );

      const result: MarketCapData = {};
      
      tokens.forEach(token => {
        const tokenData = response.data.data?.tokens?.find(
          (t: any) => t.address === token.tokenAddress
        );
        // Birdeye provides FDV (Fully Diluted Valuation) as market cap
        result[token.tokenAddress] = tokenData?.fdv || null;
      });

      return result;
    } catch (error) {
      console.error('Birdeye API error:', error);
      // Return null for all tokens in case of error
      const result: MarketCapData = {};
      tokens.forEach(token => {
        result[token.tokenAddress] = null;
      });
      return result;
    }
  }

  getProviderName(): string {
    return 'Birdeye';
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/v1/health`, {
          headers: {
            'X-API-KEY': this.envConfig.birdeyeApiKey,
          },
        }),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
