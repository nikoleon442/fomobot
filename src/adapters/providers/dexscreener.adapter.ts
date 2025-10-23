import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MarketCapProviderPort } from '../../ports/market-cap-provider.port';
import { Token, MarketCapData } from '../../domain/types';
import { ExternalServiceError, NetworkError, RateLimitError } from '../../domain/errors/application.errors';
import { ErrorHandler } from '../../domain/errors/error-handler';

@Injectable()
export class DexScreenerAdapter implements MarketCapProviderPort {
  private readonly logger = new Logger(DexScreenerAdapter.name);
  private readonly baseUrl = 'https://api.dexscreener.com';
  private readonly batchSize = 30; // DexScreener can handle up to 30 tokens per request

  constructor(private readonly httpService: HttpService) {}

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
    const result: MarketCapData = {};
    
    // Initialize all tokens with null (not found)
    tokens.forEach(token => {
      result[token.tokenAddress] = null;
    });

    try {
      // Create comma-separated list of token addresses for batch request
      // you can only do 30 tokens at a time with the batch endpoint, so we need to split the tokens into batches of 30
      const batches = [];
      for (let i = 0; i < tokens.length; i += this.batchSize) {
        batches.push(tokens.slice(i, i + this.batchSize));
      }
      
      for (const batch of batches) {
        const tokenAddresses = batch.map(token => token.tokenAddress).join(',');
        const response = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/tokens/v1/solana/${tokenAddresses}`),
        );
        
        // Process response data
        if (response.data && Array.isArray(response.data)) {
          response.data.forEach((pair: any) => {
            if (pair.baseToken && pair.baseToken.address) {
              // Use fdv if available, otherwise use marketCap, otherwise null
              const marketCap = pair.fdv || pair.marketCap;
              if (marketCap) {
                result[pair.baseToken.address] = parseFloat(marketCap);
              }
            }
          });
        }
      }
    } catch (error) {
      const applicationError = ErrorHandler.handle(error, { 
        service: 'DexScreener', 
        operation: 'fetchBatch',
        tokenCount: tokens.length 
      });
      
      // Log error but don't throw - return null values for all tokens
      this.logger.warn(`DexScreener batch API error: ${applicationError.message}`, {
        error: applicationError.message,
        tokenCount: tokens.length,
      });
      // Keep all tokens as null (not found) on error
    }

    return result;
  }

  getProviderName(): string {
    return 'DexScreener';
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test with a known Solana token (SOL)
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/tokens/v1/solana/So11111111111111111111111111111111111111112`),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
