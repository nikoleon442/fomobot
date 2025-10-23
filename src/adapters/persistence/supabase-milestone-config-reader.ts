import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MilestoneConfigRepositoryPort } from '../../ports/milestone-config-repository.port';
import { MilestoneConfig, Group } from '../../domain/types';
import { EnvConfig } from '../system/env.config';

@Injectable()
export class SupabaseMilestoneConfigReader implements MilestoneConfigRepositoryPort {
  private readonly supabase: SupabaseClient;

  constructor(private readonly envConfig: EnvConfig) {
    this.supabase = createClient(
      this.envConfig.supabaseUrl,
      this.envConfig.supabaseServiceKey,
    );
  }

  async getActiveMilestones(group: Group): Promise<MilestoneConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('milestones_config')
        .select('*')
        .eq('group_name', group)
        .eq('is_active', true)
        .order('milestone_value', { ascending: true });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return data.map(this.mapToDomainMilestoneConfig);
    } catch (error) {
      console.error(`Error fetching active milestones for group ${group}:`, error);
      throw error;
    }
  }

  async getMilestoneConfig(id: bigint): Promise<MilestoneConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('milestones_config')
        .select('*')
        .eq('id', id.toString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No rows found
        }
        throw new Error(`Supabase error: ${error.message}`);
      }

      return this.mapToDomainMilestoneConfig(data);
    } catch (error) {
      console.error(`Error fetching milestone config ${id}:`, error);
      throw error;
    }
  }

  async createMilestoneConfig(config: Omit<MilestoneConfig, 'id' | 'createdAtUtc' | 'updatedAtUtc'>): Promise<MilestoneConfig> {
    try {
      const { data, error } = await this.supabase
        .from('milestones_config')
        .insert({
          group_name: config.groupName,
          milestone_value: config.milestoneValue,
          milestone_label: config.milestoneLabel,
          is_active: config.isActive,
          created_by: config.createdBy,
          notes: config.notes
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return this.mapToDomainMilestoneConfig(data);
    } catch (error) {
      console.error('Error creating milestone config:', error);
      throw error;
    }
  }

  async updateMilestoneConfig(id: bigint, updates: Partial<MilestoneConfig>): Promise<MilestoneConfig> {
    try {
      const updateData: any = {
        updated_at_utc: new Date().toISOString()
      };

      if (updates.milestoneValue !== undefined) updateData.milestone_value = updates.milestoneValue;
      if (updates.milestoneLabel !== undefined) updateData.milestone_label = updates.milestoneLabel;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { data, error } = await this.supabase
        .from('milestones_config')
        .update(updateData)
        .eq('id', id.toString())
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return this.mapToDomainMilestoneConfig(data);
    } catch (error) {
      console.error(`Error updating milestone config ${id}:`, error);
      throw error;
    }
  }

  async deactivateMilestoneConfig(id: bigint): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('milestones_config')
        .update({ 
          is_active: false, 
          updated_at_utc: new Date().toISOString() 
        })
        .eq('id', id.toString());

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }
    } catch (error) {
      console.error(`Error deactivating milestone config ${id}:`, error);
      throw error;
    }
  }

  private mapToDomainMilestoneConfig(row: any): MilestoneConfig {
    return {
      id: BigInt(row.id),
      groupName: row.group_name,
      milestoneValue: parseFloat(row.milestone_value),
      milestoneLabel: row.milestone_label,
      isActive: row.is_active,
      createdAtUtc: new Date(row.created_at_utc),
      updatedAtUtc: new Date(row.updated_at_utc),
      createdBy: row.created_by,
      notes: row.notes,
    };
  }
}
