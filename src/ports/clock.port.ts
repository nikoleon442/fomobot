export interface ClockPort {
  /**
   * Gets the current date and time
   */
  now(): Date;

  /**
   * Gets the current timestamp in milliseconds
   */
  timestamp(): number;
}
