export abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly isRetryable: boolean;

  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DatabaseError extends ApplicationError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
  readonly isRetryable = true;

  constructor(message: string, context?: Record<string, any>) {
    super(`Database error: ${message}`, context);
  }
}

export class ExternalServiceError extends ApplicationError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  readonly isRetryable = true;

  constructor(service: string, message: string, context?: Record<string, any>) {
    super(`${service} service error: ${message}`, { service, ...context });
  }
}

export class ConfigurationError extends ApplicationError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;
  readonly isRetryable = false;

  constructor(message: string, context?: Record<string, any>) {
    super(`Configuration error: ${message}`, context);
  }
}

export class ValidationError extends ApplicationError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly isRetryable = false;

  constructor(message: string, context?: Record<string, any>) {
    super(`Validation error: ${message}`, context);
  }
}

export class RateLimitError extends ApplicationError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly statusCode = 429;
  readonly isRetryable = true;

  constructor(service: string, retryAfter?: number, context?: Record<string, any>) {
    super(`Rate limit exceeded for ${service}`, { service, retryAfter, ...context });
  }
}

export class NetworkError extends ApplicationError {
  readonly code = 'NETWORK_ERROR';
  readonly statusCode = 503;
  readonly isRetryable = true;

  constructor(message: string, context?: Record<string, any>) {
    super(`Network error: ${message}`, context);
  }
}
