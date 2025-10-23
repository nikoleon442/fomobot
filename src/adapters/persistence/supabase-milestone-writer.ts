import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MilestoneNotificationRepositoryPort } from '../../ports/milestone-notification-repository.port';
import { Token, MilestoneConfig, MilestoneNotification, Group } from '../../domain/types';
import { EnvConfig } from '../system/env.config';

@Injectable()
export class SupabaseMilestoneWriter implements MilestoneNotificationRepositoryPort {
  private readonly supabase: SupabaseClient;

  constructor(private readonly envConfig: EnvConfig) {
    this.supabase = createClient(
      this.envConfig.supabaseUrl,
      this.envConfig.supabaseServiceKey,
    );
  }

  async wasNotified(tokenId: bigint, milestoneValue: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('milestone_notifications')
        .select('id')
        .eq('token_id', tokenId.toString())
        .eq('milestone_value', milestoneValue)
        .limit(1);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data && data.length > 0;
    } catch (error) {
      console.error(`Error checking notification status for token ${tokenId}, milestone ${milestoneValue}:`, error);
      throw error;
    }
  }

  async recordNotification(
    token: Token, 
    milestone: MilestoneConfig, 
    group: Group, 
    messageId?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('milestone_notifications')
        .insert({
          token_id: token.id.toString(),
          token_address: token.tokenAddress,
          group_name: group,
          milestone_value: milestone.milestoneValue,
          milestone_label: milestone.milestoneLabel,
          message_id: messageId
        });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error recording milestone notification:', error);
      throw error;
    }
  }

  async getNotificationsForToken(tokenId: bigint): Promise<MilestoneNotification[]> {
    try {
      const { data, error } = await this.supabase
        .from('milestone_notifications')
        .select('*')
        .eq('token_id', tokenId.toString())
        .order('notified_at_utc', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data.map(this.mapToDomainNotification);
    } catch (error) {
      console.error(`Error fetching notifications for token ${tokenId}:`, error);
      throw error;
    }
  }

  private mapToDomainNotification(row: any): MilestoneNotification {
    return {
      id: BigInt(row.id),
      tokenId: BigInt(row.token_id),
      tokenAddress: row.token_address,
      groupName: row.group_name,
      milestoneValue: parseFloat(row.milestone_value),
      milestoneLabel: row.milestone_label,
      notifiedAtUtc: new Date(row.notified_at_utc),
      messageId: row.message_id,
    };
  }
}
