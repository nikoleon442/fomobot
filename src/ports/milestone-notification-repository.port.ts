import { Token, MilestoneConfig, MilestoneNotification, Group } from '../domain/types';

export interface MilestoneNotificationRepositoryPort {
  wasNotified(tokenId: bigint, milestoneValue: number): Promise<boolean>;
  recordNotification(
    token: Token, 
    milestone: MilestoneConfig, 
    group: Group, 
    messageId?: string
  ): Promise<void>;
  getNotificationsForToken(tokenId: bigint): Promise<MilestoneNotification[]>;
}
