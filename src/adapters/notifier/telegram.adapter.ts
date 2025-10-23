import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NotifierPort } from '../../ports/notifier.port';
import { Group } from '../../domain/types';
import { EnvConfig } from '../system/env.config';

@Injectable()
export class TelegramAdapter implements NotifierPort {
  private readonly logger = new Logger(TelegramAdapter.name);
  private readonly baseUrl: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(
    private readonly httpService: HttpService,
    private readonly envConfig: EnvConfig,
  ) {
    this.baseUrl = `https://api.telegram.org/bot${this.envConfig.telegramBotToken}`;
  }

  async send(group: Group, message: string): Promise<void> {
    const chatId = group === 'fsm' 
      ? this.envConfig.telegramChatIdFsm 
      : this.envConfig.telegramChatIdIssam;

    await this.sendWithRetry(chatId, message);
  }

  private async sendWithRetry(chatId: string, message: string): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.sendMessage(chatId, message);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Telegram send attempt ${attempt} failed`, {
          attempt,
          error: error.message,
          chatId,
        });

        if (attempt < this.maxRetries) {
          // Wait before retry with exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to send Telegram message after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  private async sendMessage(chatId: string, message: string): Promise<void> {
    const response = await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    );

    if (!response.data.ok) {
      throw new Error(`Telegram API error: ${response.data.description}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/getMe`),
      );
      return response.data.ok === true;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
