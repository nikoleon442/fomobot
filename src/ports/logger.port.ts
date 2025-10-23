export interface LoggerPort {
  /**
   * Logs an informational message
   */
  info(event: string, data?: object): void;

  /**
   * Logs a warning message
   */
  warn(event: string, data?: object): void;

  /**
   * Logs an error message
   */
  error(event: string, data?: object): void;

  /**
   * Logs a debug message (only in development)
   */
  debug(event: string, data?: object): void;
}
