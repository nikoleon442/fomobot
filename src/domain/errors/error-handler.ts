import { ApplicationError, DatabaseError, ExternalServiceError, ConfigurationError, ValidationError, RateLimitError, NetworkError } from './application.errors';

export class ErrorHandler {
  static handle(error: unknown, context?: Record<string, any>): ApplicationError {
    if (error instanceof ApplicationError) {
      return error;
    }

    // Handle specific error types
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Database errors
      if (message.includes('supabase') || message.includes('database') || message.includes('sql')) {
        return new DatabaseError(error.message, { originalError: error, ...context });
      }

      // Network errors
      if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
        return new NetworkError(error.message, { originalError: error, ...context });
      }

      // Rate limiting
      if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
        return new RateLimitError('external service', undefined, { originalError: error, ...context });
      }

      // External service errors
      if (message.includes('api') || message.includes('http') || message.includes('service')) {
        return new ExternalServiceError('external service', error.message, { originalError: error, ...context });
      }

      // Configuration errors
      if (message.includes('config') || message.includes('environment') || message.includes('missing')) {
        return new ConfigurationError(error.message, { originalError: error, ...context });
      }

      // Validation errors
      if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
        return new ValidationError(error.message, { originalError: error, ...context });
      }
    }

    // Unknown error - create a concrete implementation
    return new DatabaseError('Unknown error occurred', { originalError: error, ...context });
  }

  static isRetryable(error: ApplicationError): boolean {
    return error.isRetryable;
  }

  static getRetryDelay(error: ApplicationError, attempt: number): number {
    if (!this.isRetryable(error)) {
      return 0;
    }

    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter
    
    return delay + jitter;
  }
}
