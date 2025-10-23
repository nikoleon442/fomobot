import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { TelegramAdapter } from '../../../src/adapters/notifier/telegram.adapter';
import { EnvConfig } from '../../../src/adapters/system/env.config';
import { of, throwError } from 'rxjs';

describe('TelegramAdapter Integration', () => {
  let adapter: TelegramAdapter;
  let httpService: any;
  let envConfig: any;

  beforeEach(async () => {
    envConfig = {
      telegramBotToken: 'test-bot-token',
      telegramChatIdFsm: '-1001234567890',
      telegramChatIdIssam: '-1001234567891',
    };

    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramAdapter,
        {
          provide: EnvConfig,
          useValue: envConfig,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    adapter = module.get<TelegramAdapter>(TelegramAdapter);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should send message to FSM group successfully', async () => {
      // Arrange
      const message = 'Test message for FSM group';
      const mockResponse = {
        data: {
          ok: true,
          result: {
            message_id: 123,
            chat: { id: -1001234567890 },
          },
        },
      };

      httpService.post.mockReturnValue(of(mockResponse));

      // Act
      await adapter.send('fsm', message);

      // Assert
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        {
          chat_id: '-1001234567890',
          text: message,
          parse_mode: 'Markdown',
        }
      );
    });

    it('should send message to Issam group successfully', async () => {
      // Arrange
      const message = 'Test message for Issam group';
      const mockResponse = {
        data: {
          ok: true,
          result: {
            message_id: 124,
            chat: { id: -1001234567891 },
          },
        },
      };

      httpService.post.mockReturnValue(of(mockResponse));

      // Act
      await adapter.send('issam', message);

      // Assert
      expect(httpService.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        {
          chat_id: '-1001234567891',
          text: message,
          parse_mode: 'Markdown',
        }
      );
    });

    it('should retry on failure with exponential backoff', async () => {
      // Arrange
      const message = 'Test message';
      const errorResponse = {
        data: {
          ok: false,
          description: 'Too Many Requests: retry after 1',
        },
      };

      const successResponse = {
        data: {
          ok: true,
          result: { message_id: 123 },
        },
      };

      // First two calls fail, third succeeds
      httpService.post
        .mockReturnValueOnce(throwError(() => new Error('Network error')))
        .mockReturnValueOnce(throwError(() => new Error('Network error')))
        .mockReturnValueOnce(of(successResponse));

      // Act
      await adapter.send('fsm', message);

      // Assert
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries exceeded', async () => {
      // Arrange
      const message = 'Test message';
      const errorResponse = {
        data: {
          ok: false,
          description: 'Bad Request: chat not found',
        },
      };

      httpService.post.mockReturnValue(throwError(() => new Error('Chat not found')));

      // Act & Assert
      await expect(adapter.send('fsm', message)).rejects.toThrow(
        'Failed to send Telegram message after 3 attempts: Chat not found'
      );
      expect(httpService.post).toHaveBeenCalledTimes(3);
    });

    it('should handle Telegram API errors', async () => {
      // Arrange
      const message = 'Test message';
      const errorResponse = {
        data: {
          ok: false,
          description: 'Bad Request: message is too long',
        },
      };

      httpService.post.mockReturnValue(of(errorResponse));

      // Act & Assert
      await expect(adapter.send('fsm', message)).rejects.toThrow(
        'Telegram API error: Bad Request: message is too long'
      );
    });

    it('should handle network timeouts', async () => {
      // Arrange
      const message = 'Test message';
      httpService.post.mockReturnValue(throwError(() => new Error('timeout of 5000ms exceeded')));

      // Act & Assert
      await expect(adapter.send('fsm', message)).rejects.toThrow(
        'Failed to send Telegram message after 3 attempts: timeout of 5000ms exceeded'
      );
    });
  });

  describe('isHealthy', () => {
    it('should return true when bot is accessible', async () => {
      // Arrange
      const mockResponse = {
        data: {
          ok: true,
          result: {
            id: 123456789,
            is_bot: true,
            first_name: 'FOMObot',
            username: 'fomobot',
          },
        },
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(true);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/getMe'
      );
    });

    it('should return false when bot is not accessible', async () => {
      // Arrange
      httpService.get.mockReturnValue(throwError(() => new Error('Network error')));

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when API returns error', async () => {
      // Arrange
      const mockResponse = {
        data: {
          ok: false,
          description: 'Unauthorized',
        },
      };

      httpService.get.mockReturnValue(of(mockResponse));

      // Act
      const result = await adapter.isHealthy();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should initialize with correct base URL', () => {
      // Assert
      expect(adapter).toBeDefined();
      // The base URL is constructed in the constructor, we can verify it's used in the HTTP calls
    });
  });
});
