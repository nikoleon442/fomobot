import { Token, Group } from '../domain/types';

export interface TokenRepositoryPort {
  /**
   * Retrieves all tokens for a specific group
   * @param group The group to fetch tokens for ('fsm' or 'issam')
   * @returns Promise resolving to array of tokens
   */
  listAll(group: Group): Promise<Token[]>;

  /**
   * Checks if the repository is available and healthy
   */
  isHealthy(): Promise<boolean>;
}
