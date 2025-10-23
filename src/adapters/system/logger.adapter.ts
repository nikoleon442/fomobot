import { Injectable } from '@nestjs/common';
import { LoggerPort } from '../../ports/logger.port';
import { EnvConfig } from './env.config';

@Injectable()
export class LoggerAdapter implements LoggerPort {
  constructor(private readonly envConfig: EnvConfig) {}

  info(event: string, data?: object): void {
    console.log(`[INFO] ${event}`, data ? JSON.stringify(data) : '');
  }

  warn(event: string, data?: object): void {
    console.warn(`[WARN] ${event}`, data ? JSON.stringify(data) : '');
  }

  error(event: string, data?: object): void {
    console.error(`[ERROR] ${event}`, data ? JSON.stringify(data) : '');
  }

  debug(event: string, data?: object): void {
    if (this.envConfig.isDevelopment) {
      console.debug(`[DEBUG] ${event}`, data ? JSON.stringify(data) : '');
    }
  }
}
