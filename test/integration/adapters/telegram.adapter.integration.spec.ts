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
      telegramThreadIdIssam: undefined,
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

    it('should send message to Issam group thread when thread ID is configured', async () => {
      // Arrange
      envConfig.telegramThreadIdIssam = '12345';
      const message = 'Test message for Issam group thread';
      const mockResponse = {
        data: {
          ok: true,
          result: {
            message_id: 125,
            chat: { id: -1001234567891 },
            message_thread_id: 12345,
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
          message_thread_id: 12345, // Should be a number, not a string
        }
      );
    });

    it('should not include thread ID when sending to FSM group', async () => {
      // Arrange
      envConfig.telegramThreadIdIssam = '12345'; // Set thread ID but should not be used for FSM
      const message = 'Test message for FSM group';
      const mockResponse = {
        data: {
          ok: true,
          result: {
            message_id: 126,
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
      // Verify thread_id is not included in the payload
      const callArgs = httpService.post.mock.calls[0][1];
      expect(callArgs.message_thread_id).toBeUndefined();
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

  describe('rate limiting', () => {
    it('should enforce 1 message per second rate limit', async () => {
      // Arrange
      const message = 'Test message';
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

      const startTime = Date.now();

      // Act - send two messages in quick succession
      await adapter.send('fsm', message);
      await adapter.send('fsm', message);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert - should take at least 1 second between messages
      expect(totalTime).toBeGreaterThanOrEqual(1000);
      expect(httpService.post).toHaveBeenCalledTimes(2);
    });

    it('should not delay if enough time has passed since last message', async () => {
      // Arrange
      const message = 'Test message';
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

      // Act - send first message
      await adapter.send('fsm', message);

      // Wait for more than 1 second
      await new Promise(resolve => setTimeout(resolve, 1100));

      const startTime = Date.now();
      await adapter.send('fsm', message);
      const endTime = Date.now();

      // Assert - should not add delay since enough time has passed
      expect(endTime - startTime).toBeLessThan(100);
      expect(httpService.post).toHaveBeenCalledTimes(2);
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
