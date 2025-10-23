import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TokenRepositoryPort } from '../../ports/token-repository.port';
import { Token, Group } from '../../domain/types';
import { EnvConfig } from '../system/env.config';
import { DatabaseError, ConfigurationError } from '../../domain/errors/application.errors';
import { ErrorHandler } from '../../domain/errors/error-handler';

@Injectable()
export class SupabaseReader implements TokenRepositoryPort {
  private readonly logger = new Logger(SupabaseReader.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly envConfig: EnvConfig) {
    try {
      if (!this.envConfig.supabaseUrl || !this.envConfig.supabaseServiceKey) {
        throw new Error('Supabase URL and service key are required');
      }
      
      this.supabase = createClient(
        this.envConfig.supabaseUrl,
        this.envConfig.supabaseServiceKey,
      );
    } catch (error) {
      throw new ConfigurationError('Failed to initialize Supabase client', {
        error: error.message,
        url: this.envConfig.supabaseUrl,
      });
    }
  }

  async listAll(group: Group): Promise<Token[]> {
    try {
      const tableName = group === 'fsm' 
        ? this.envConfig.supabaseTableFsm 
        : this.envConfig.supabaseTableIssam;
      
      const { data, error } = await this.supabase
        .from(tableName)
        .select('*')
        .order('first_called_at_utc', { ascending: false })
        .limit(100);

      if (error) {
        throw new DatabaseError(`Failed to fetch tokens from ${tableName}`, {
          group,
          tableName,
          supabaseError: error.message,
        });
      }

      return data.map(this.mapToDomainToken);
    } catch (error) {
      const applicationError = ErrorHandler.handle(error, { group, operation: 'listAll' });
      throw applicationError;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test connection by fetching a single row from FSM table
      const { error } = await this.supabase
        .from(this.envConfig.supabaseTableFsm)
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      // Log error but don't throw - health check should be non-blocking
      this.logger.error('Supabase health check failed', error);
      return false;
    }
  }

  private mapToDomainToken(row: any): Token {
    return {
      id: BigInt(row.id),
      tokenAddress: row.token_address,
      symbol: row.symbol,
      initialMarketCapUsd: parseFloat(row.initial_market_cap_usd),
      firstCalledAtUtc: new Date(row.first_called_at_utc),
    };
  }
}
