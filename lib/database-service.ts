'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ScheduleItem, Idea } from '@/lib/supabase';
import { ScheduleUpdate, IdeaUpdate, HabitUpdate } from '@/lib/ai-service';

/**
 * Database service for handling CRUD operations with Supabase
 */
export const DatabaseService = {
  /**
   * Save schedule updates to database
   */
  async saveScheduleItems(updates: ScheduleUpdate[]): Promise<void> {
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
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
        await supabase.from('schedule_items').insert({
          user_id: user.id,
          title: update.title,
          start_time: startTimestamp,
          end_time: endTimestamp,
          all_day: update.all_day || false,
          priority: update.priority,
          description: update.description,
          recurrence_rule: update.recurrence_rule
        });
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
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Insert each idea
      for (const update of updates) {
        await supabase.from('ideas').insert({
          user_id: user.id,
          content: update.content,
        });
      }
    } catch (error) {
      console.error('Error saving ideas:', error);
      throw new Error('Failed to save ideas');
    }
  },
  
  /**
   * Save habit updates to database
   */
  async saveHabits(updates: HabitUpdate[]): Promise<void> {
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Insert each habit into the habits table
      for (const update of updates) {
        await supabase.from('habits').insert({
          user_id: user.id,
          title: update.title,
          frequency: update.frequency || 'Daily',
          type: update.type || 'daily',
          description: update.description,
          target_days: update.target_days,
          streak: update.streak || 0
        });
      }
    } catch (error) {
      console.error('Error saving habits:', error);
      throw new Error('Failed to save habits');
    }
  },
  
  /**
   * Get schedule items for the current user
   */
  async getScheduleItems(): Promise<ScheduleItem[]> {
    const supabase = createClientComponentClient();
    
    try {
      const { data, error } = await supabase
        .from('schedule_items')
        .select('*')
        .order('start_time', { ascending: true });
        
      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        title: item.title,
        start_time: item.start_time,  // Keep full ISO timestamp
        end_time: item.end_time,      // Keep full ISO timestamp
        description: item.description,
        priority: item.priority,
        all_day: item.all_day,
        recurrence_rule: item.recurrence_rule,
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
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching ideas:', error);
      throw new Error('Failed to fetch ideas');
    }
  },
  
  /**
   * Get habits for the current user
   */
  async getHabits(): Promise<any[]> {
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching habits:', error);
      throw new Error('Failed to fetch habits');
    }
  },

  /**
   * Delete a schedule item for the current user
   */
  async deleteScheduleItem(id: string): Promise<void> {
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      const { error } = await supabase
        .from('schedule_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting schedule item:', error);
      throw new Error('Failed to delete schedule item');
    }
  },
  
  /**
   * Delete a habit for the current user
   */
  async deleteHabit(id: string): Promise<void> {
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting habit:', error);
      throw new Error('Failed to delete habit');
    }
  },
  
  /**
   * Delete an idea for the current user
   */
  async deleteIdea(id: string): Promise<void> {
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
        
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
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('bio')
        .eq('id', user.id)
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
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio })
        .eq('id', user.id);
        
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