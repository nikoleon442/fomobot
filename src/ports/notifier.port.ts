import { Group } from '../domain/types';

export interface NotifierPort {
  /**
   * Sends a message to the specified group's Telegram chat
   * @param group The group to send the message to
   * @param message The message content to send
   */
  send(group: Group, message: string): Promise<void>;

  /**
   * Checks if the notifier is available and healthy
   */
  isHealthy(): Promise<boolean>;
}
