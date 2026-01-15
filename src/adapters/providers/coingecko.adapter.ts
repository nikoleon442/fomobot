import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MarketCapProviderPort } from '../../ports/market-cap-provider.port';
import { Token, MarketCapData } from '../../domain/types';

@Injectable()
export class CoinGeckoAdapter implements MarketCapProviderPort {
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly batchSize = 100;

  constructor(private readonly httpService: HttpService) {}

  async getCaps(tokens: Token[]): Promise<MarketCapData> {
    const result: MarketCapData = {};
    // Process tokens in batches to avoid rate limits
    for (let i = 0; i < tokens.length; i += this.batchSize) {
      const batch = tokens.slice(i, i + this.batchSize);
      const batchResult = await this.fetchBatch(batch);
      Object.assign(result, batchResult);
    }

    return result;
  }

  private async fetchBatch(tokens: Token[]): Promise<MarketCapData> {
    try {
      // For CoinGecko, we need to map token addresses to coin IDs
      // This is a simplified implementation - in reality, you'd need a mapping service
      const addresses = tokens.map(t => t.tokenAddress);
      
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/simple/price`, {
          params: {
            ids: addresses.join(','),
            vs_currencies: 'usd',
            include_market_cap: 'true',
          },
        }),
      );

      const result: MarketCapData = {};
      
      tokens.forEach(token => {
        const coinData = response.data[token.tokenAddress];
        result[token.tokenAddress] = coinData?.usd_market_cap || null;
      });

      return result;
    } catch (error) {
      console.error('CoinGecko API error:', error);
      // Return null for all tokens in case of error
      const result: MarketCapData = {};
      tokens.forEach(token => {
        result[token.tokenAddress] = null;
      });
      return result;
    }
  }

  getProviderName(): string {
    return 'CoinGecko';
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/ping`),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
