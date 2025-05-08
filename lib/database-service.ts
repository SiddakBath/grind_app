'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ScheduleItem, Idea, Goal } from '@/lib/supabase';
import { ScheduleUpdate, IdeaUpdate, GoalUpdate } from '@/lib/ai-service';

export interface Resource {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string;
  category: 'Article' | 'Video' | 'Course' | 'Tool';
  relevance_score: number;
  created_at: string;
  last_accessed: string;
}

/**
 * Database service for handling CRUD operations with Supabase
 */
export const DatabaseService = {
  /**
   * Get the current session and user ID
   */
  async getCurrentUser() {
    const supabase = createClientComponentClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      throw new Error('Failed to get session');
    }
    
    if (!session?.user) {
      throw new Error('User not authenticated');
    }
    
    return { session, userId: session.user.id };
  },

  /**
   * Save schedule updates to database
   */
  async saveScheduleItems(updates: ScheduleUpdate[]): Promise<void> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      // Insert each schedule item
      for (const update of updates) {
        // Get current date
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        // Create ISO timestamps by combining date and time
        const startTimeStr = update.start_time || "12:00";
        const endTimeStr = update.end_time || "13:00";
        
        const startTimestamp = `${dateStr}T${startTimeStr}:00.000Z`;
        const endTimestamp = `${dateStr}T${endTimeStr}:00.000Z`;
        
        // Save to database
        const { error } = await supabase.from('schedule_items').insert({
          user_id: userId,
          title: update.title,
          start_time: startTimestamp,
          end_time: endTimestamp,
          all_day: update.all_day || false,
          priority: update.priority,
          description: update.description,
          recurrence_rule: update.recurrence_rule,
          type: update.type || 'task'  // Ensure type is set
        });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving schedule items:', error);
      throw new Error('Failed to save schedule items');
    }
  },
  
  /**
   * Save idea updates to database
   */
  async saveIdeas(updates: IdeaUpdate[]): Promise<void> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      // Insert each idea
      for (const update of updates) {
        const { error } = await supabase.from('ideas').insert({
          user_id: userId,
          content: update.content,
        });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving ideas:', error);
      throw new Error('Failed to save ideas');
    }
  },
  
  /**
   * Save goal updates to database
   */
  async saveGoals(updates: GoalUpdate[]): Promise<void> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      // Insert each goal into the goals table
      for (const update of updates) {
        const { error } = await supabase.from('goals').insert({
          user_id: userId,
          title: update.title,
          description: update.description,
          target_date: update.target_date,
          progress: update.progress || 0,
          category: update.category || 'Personal'
        });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving goals:', error);
      throw new Error('Failed to save goals');
    }
  },
  
  /**
   * Get schedule items for the current user
   */
  async getScheduleItems(): Promise<ScheduleItem[]> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      const { data, error } = await supabase
        .from('schedule_items')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: true });
        
      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        title: item.title,
        start_time: item.start_time,
        end_time: item.end_time,
        description: item.description,
        priority: item.priority,
        all_day: item.all_day,
        recurrence_rule: item.recurrence_rule,
        type: item.type || 'task',
        user_id: item.user_id,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
    } catch (error) {
      console.error('Error fetching schedule items:', error);
      throw new Error('Failed to fetch schedule items');
    }
  },
  
  /**
   * Get ideas for the current user
   */
  async getIdeas(): Promise<Idea[]> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching ideas:', error);
      throw new Error('Failed to fetch ideas');
    }
  },
  
  /**
   * Get goals for the current user
   */
  async getGoals(): Promise<Goal[]> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('target_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching goals:', error);
      throw new Error('Failed to fetch goals');
    }
  },

  /**
   * Delete a schedule item for the current user
   */
  async deleteScheduleItem(id: string): Promise<void> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      const { error } = await supabase
        .from('schedule_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting schedule item:', error);
      throw new Error('Failed to delete schedule item');
    }
  },
  
  /**
   * Delete a goal for the current user
   */
  async deleteGoal(id: string): Promise<void> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw new Error('Failed to delete goal');
    }
  },
  
  /**
   * Delete an idea for the current user
   */
  async deleteIdea(id: string): Promise<void> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting idea:', error);
      throw new Error('Failed to delete idea');
    }
  },
  
  /**
   * Get user's biography from profiles table
   */
  async getUserBio(): Promise<string> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('bio')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error('Error fetching user bio:', error);
        return '';
      }
      
      return data?.bio || '';
    } catch (error) {
      console.error('Error fetching user bio:', error);
      return '';
    }
  },
  
  /**
   * Update user's biography in profiles table
   */
  async updateUserBio(bio: string): Promise<void> {
    try {
      const { userId } = await this.getCurrentUser();
      const supabase = createClientComponentClient();
      
      const { error } = await supabase
        .from('profiles')
        .update({ bio })
        .eq('id', userId);
        
      if (error) {
        console.error('Error updating user bio:', error);
        throw new Error('Failed to update user bio');
      }
    } catch (error) {
      console.error('Error updating user bio:', error);
      throw new Error('Failed to update user bio');
    }
  },
}; 