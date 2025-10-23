import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const envSchema = z.object({
  // Polling configuration
  POLL_INTERVAL_SECONDS: z.string().transform(Number).default('60'),
  
  // Provider configuration
  MARKET_CAP_PROVIDER: z.enum(['coingecko', 'cmc', 'birdeye', 'dexscreener']).default('dexscreener'),
  
  // Supabase configuration
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),
  SUPABASE_TABLE_FSM: z.string().default('tokens_fsm'),
  SUPABASE_TABLE_ISSAM: z.string().default('tokens_issam'),
  
  // Telegram configuration
  TG_BOT_TOKEN: z.string().min(1, 'TG_BOT_TOKEN is required'),
  TG_CHAT_ID_FSM: z.string().min(1, 'TG_CHAT_ID_FSM is required'),
  TG_CHAT_ID_ISSAM: z.string().min(1, 'TG_CHAT_ID_ISSAM is required'),
  
  // Provider API keys (optional)
  CMC_API_KEY: z.string().optional(),
  BIRDEYE_API_KEY: z.string().optional(),
  
  // Server configuration
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type EnvConfigType = z.infer<typeof envSchema>;

@Injectable()
export class EnvConfig {
  private readonly config: EnvConfigType;

  constructor() {
    this.config = envSchema.parse(process.env);
  }

  get pollIntervalSeconds(): number {
    return this.config.POLL_INTERVAL_SECONDS;
  }

  get marketCapProvider(): 'coingecko' | 'cmc' | 'birdeye' | 'dexscreener' {
    return this.config.MARKET_CAP_PROVIDER;
  }

  get supabaseUrl(): string {
    return this.config.SUPABASE_URL;
  }

  get supabaseServiceKey(): string {
    return this.config.SUPABASE_SERVICE_KEY;
  }

  get supabaseTableFsm(): string {
    return this.config.SUPABASE_TABLE_FSM;
  }

  get supabaseTableIssam(): string {
    return this.config.SUPABASE_TABLE_ISSAM;
  }

  get telegramBotToken(): string {
    return this.config.TG_BOT_TOKEN;
  }

  get telegramChatIdFsm(): string {
    return this.config.TG_CHAT_ID_FSM;
  }

  get telegramChatIdIssam(): string {
    return this.config.TG_CHAT_ID_ISSAM;
  }

  get cmcApiKey(): string | undefined {
    return this.config.CMC_API_KEY;
  }

  get birdeyeApiKey(): string | undefined {
    return this.config.BIRDEYE_API_KEY;
  }

  get port(): number {
    return this.config.PORT;
  }

  get nodeEnv(): string {
    return this.config.NODE_ENV;
  }

  get isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }
}
