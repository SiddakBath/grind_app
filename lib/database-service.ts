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
        // Convert date and time strings to timestamp
        // Format expected: "2023-04-15" for date and "3:00 PM" for time
        const dateStr = update.date || new Date().toISOString().split('T')[0];
        const timeStr = update.time || "12:00 PM";
        
        // Simple date-time parsing (could be improved for robust handling)
        const [year, month, day] = dateStr.split('-').map(Number);
        let [hourStr, minuteStr] = timeStr.split(':');
        let hour = parseInt(hourStr);
        const minute = parseInt(minuteStr.replace(/[^\d]/g, ''));
        
        // Handle AM/PM
        const isPM = timeStr.toLowerCase().includes('pm');
        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        
        // First create a date object in the user's local timezone
        const localDate = new Date(year, month - 1, day, hour, minute);
        
        // Convert local time to UTC timestamp for storage
        const timestamp = localDate.toISOString();
        
        await supabase.from('schedule_items').insert({
          user_id: user.id,
          title: update.title,
          time: timestamp,
          priority: update.priority,
          description: update.description,
          duration: update.duration || 60,
          recurring: update.recurring || null,
          repeat_days: update.repeat_days || null,
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
   * Save habit updates to database (using ideas table for now)
   */
  async saveHabits(updates: HabitUpdate[]): Promise<void> {
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Insert each habit as an idea with special prefix for now
      for (const update of updates) {
        const habitContent = `[HABIT] ${update.title} - Frequency: ${update.frequency || 'Daily'}, Type: ${update.type || 'daily'}`;
        
        await supabase.from('ideas').insert({
          user_id: user.id,
          content: habitContent,
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
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      const { data, error } = await supabase
        .from('schedule_items')
        .select('*')
        .eq('user_id', user.id)
        .order('time', { ascending: true });
        
      if (error) throw error;
      
      // Process the data for display
      return (data || []).map(item => {
        // Convert timestamp to date string and time string
        const date = new Date(item.time);
        
        // Format date for display (YYYY-MM-DD)
        // Using local date to ensure it shows correctly in user's timezone
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        // Format the time for display (12-hour format)
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert 0 to 12
        const timeStr = `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        
        return {
          id: item.id,
          title: item.title,
          time: timeStr,
          date: dateStr,
          description: item.description,
          priority: item.priority,
          duration: item.duration || 60,
          recurring: item.recurring,
          repeat_days: item.repeat_days,
          user_id: item.user_id,
          created_at: item.created_at,
          updated_at: item.updated_at,
        };
      });
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
        .not('content', 'ilike', '[HABIT]%')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching ideas:', error);
      throw new Error('Failed to fetch ideas');
    }
  },
  
  /**
   * Get habits for the current user (filtered from ideas table)
   */
  async getHabits(): Promise<Idea[]> {
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
        .ilike('content', '[HABIT]%')
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
}; 