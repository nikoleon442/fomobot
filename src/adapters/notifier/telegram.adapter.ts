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
  private readonly rateLimitDelay = 1000; // 1 second between messages
  private lastMessageTime = 0;

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

    // Apply rate limiting (1 message per second)
    await this.enforceRateLimit();

    // Use thread ID for Issam group if configured
    const threadId = group === 'issam' ? this.envConfig.telegramThreadIdIssam : undefined;
    await this.sendWithRetry(chatId, message, threadId);
  }

  private async sendWithRetry(chatId: string, message: string, threadId?: string): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.sendMessage(chatId, message, threadId);
        return; // Success, exit retry loop
      } catch (error: any) {
        lastError = error as Error;
        // Extract more detailed error information if available
        const errorDetails: any = {
          attempt,
          error: error.message,
          chatId,
          threadId,
        };
        
        // If it's an Axios error, include response data for better debugging
        if (error.response?.data) {
          errorDetails.apiError = error.response.data.description || error.response.data;
          errorDetails.statusCode = error.response.status;
        }
        
        this.logger.warn(`Telegram send attempt ${attempt} failed`, errorDetails);

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

  private async sendMessage(chatId: string, message: string, threadId?: string): Promise<void> {
    const payload: {
      chat_id: string;
      text: string;
      parse_mode: string;
      message_thread_id?: number;
    } = {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    };

    // Add thread ID if provided (for group threads)
    // Telegram API requires message_thread_id to be a number, not a string
    if (threadId) {
      const threadIdNum = parseInt(threadId, 10);
      if (isNaN(threadIdNum)) {
        this.logger.warn(`Invalid thread ID format: ${threadId}, sending without thread ID`);
      } else {
        payload.message_thread_id = threadIdNum;
      }
    }

    const response = await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/sendMessage`, payload),
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

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;
    
    if (timeSinceLastMessage < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastMessage;
      this.logger.debug(`Rate limiting: waiting ${waitTime}ms before sending message`);
      await this.sleep(waitTime);
    }
    
    this.lastMessageTime = Date.now();
  }
}
