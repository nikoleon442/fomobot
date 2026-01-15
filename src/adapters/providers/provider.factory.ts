import { Injectable } from '@nestjs/common';
import { MarketCapProviderPort } from '../../ports/market-cap-provider.port';
import { CoinGeckoAdapter } from './coingecko.adapter';
import { CMCAdapter } from './cmc.adapter';
import { BirdeyeAdapter } from './birdeye.adapter';
import { DexScreenerAdapter } from './dexscreener.adapter';
import { GeckoTerminalAdapter } from './geckoterminal.adapter';
import { EnvConfig } from '../system/env.config';

@Injectable()
export class MarketCapProviderFactory {
  constructor(
    private readonly coinGeckoAdapter: CoinGeckoAdapter,
    private readonly cmcAdapter: CMCAdapter,
    private readonly birdeyeAdapter: BirdeyeAdapter,
    private readonly dexScreenerAdapter: DexScreenerAdapter,
    private readonly geckoTerminalAdapter: GeckoTerminalAdapter,
    private readonly envConfig: EnvConfig,
  ) {}

  getProvider(): MarketCapProviderPort {
    switch (this.envConfig.marketCapProvider) {
      case 'coingecko':
        return this.coinGeckoAdapter;
      case 'cmc':
        return this.cmcAdapter;
      case 'birdeye':
        return this.birdeyeAdapter;
      case 'dexscreener':
        return this.dexScreenerAdapter;
      case 'geckoterminal':
        return this.geckoTerminalAdapter;
      default:
        return this.dexScreenerAdapter; // Default to DexScreener for Solana
    }
  }

  getAllProviders(): MarketCapProviderPort[] {
    return [
      this.coinGeckoAdapter,
      this.cmcAdapter,
      this.birdeyeAdapter,
      this.dexScreenerAdapter,
      this.geckoTerminalAdapter,
    ];
  }
}
