import { Token, MarketCapData } from '../domain/types';

export interface MarketCapProviderPort {
  /**
   * Fetches current market cap data for the given tokens
   * @param tokens Array of tokens to fetch market cap for
   * @returns Promise resolving to a map of token addresses to their market cap (or null if not found)
   */
  getCaps(tokens: Token[]): Promise<MarketCapData>;

  /**
   * Gets the provider name for identification
   */
  getProviderName(): string;

  /**
   * Checks if the provider is available and healthy
   */
  isHealthy(): Promise<boolean>;
}
