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
        // Format expected: "2023-04-15" for date and "3:00 PM" or "15:00" for time
        const dateStr = update.date || new Date().toISOString().split('T')[0];
        const startTimeStr = update.start_time || "12:00 PM";
        const endTimeStr = update.end_time || "13:00 PM"; // Default to 1 hour later
        
        // Simple date-time parsing (could be improved for robust handling)
        const [year, month, day] = dateStr.split('-').map(Number);
        
        // Parse start time string with more robust handling
        let startHour = 0;
        let startMinute = 0;
        
        // Parse time string with more robust handling
        try {
          // Parse start time
          if (startTimeStr.includes(':')) {
            // Handle formats like "3:00 PM" or "15:00"
            let [hourStr, minuteStr] = startTimeStr.split(':');
            
            // Extract only numbers from minute string (in case it has AM/PM)
            minuteStr = minuteStr.replace(/[^\d]/g, '');
            
            startHour = parseInt(hourStr);
            startMinute = parseInt(minuteStr);
            
            // Handle AM/PM if present
            const isPM = startTimeStr.toLowerCase().includes('pm');
            if (isPM && startHour < 12) startHour += 12;
            if (!isPM && startHour === 12 && startTimeStr.toLowerCase().includes('am')) startHour = 0;
          } else {
            // Handle numeric time like "1500" for 15:00
            if (/^\d+$/.test(startTimeStr)) {
              const timeNum = parseInt(startTimeStr);
              startHour = Math.floor(timeNum / 100);
              startMinute = timeNum % 100;
            } else {
              // Default time if format is unrecognized
              startHour = 12;
              startMinute = 0;
            }
          }
          
          // Parse end time
          let endHour = startHour + 1; // Default to one hour later
          let endMinute = startMinute;
          
          if (endTimeStr && endTimeStr !== startTimeStr) {
            if (endTimeStr.includes(':')) {
              let [hourStr, minuteStr] = endTimeStr.split(':');
              minuteStr = minuteStr.replace(/[^\d]/g, '');
              
              endHour = parseInt(hourStr);
              endMinute = parseInt(minuteStr);
              
              const isPM = endTimeStr.toLowerCase().includes('pm');
              if (isPM && endHour < 12) endHour += 12;
              if (!isPM && endHour === 12 && endTimeStr.toLowerCase().includes('am')) endHour = 0;
            } else if (/^\d+$/.test(endTimeStr)) {
              const timeNum = parseInt(endTimeStr);
              endHour = Math.floor(timeNum / 100);
              endMinute = timeNum % 100;
            }
          }
          
          // Validate hours and minutes
          if (isNaN(startHour) || startHour < 0 || startHour > 23) startHour = 12;
          if (isNaN(startMinute) || startMinute < 0 || startMinute > 59) startMinute = 0;
          if (isNaN(endHour) || endHour < 0 || endHour > 23) endHour = startHour + 1;
          if (isNaN(endMinute) || endMinute < 0 || endMinute > 59) endMinute = startMinute;
          
          // Make sure end time is after start time
          if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
            endHour = startHour + 1;
            endMinute = startMinute;
          }
          
          // Create date objects in the user's local timezone
          const startDate = new Date(year, month - 1, day, startHour, startMinute);
          const endDate = new Date(year, month - 1, day, endHour, endMinute);
          
          // Ensure the dates are valid before proceeding
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error(`Invalid date created from: ${dateStr} ${startTimeStr} / ${endTimeStr}`);
          }
          
          // Convert local time to UTC timestamp for storage
          const startTimestamp = startDate.toISOString();
          const endTimestamp = endDate.toISOString();
          
          // Convert recurrence information
          let recurrenceRule = null;
          if (update.recurring) {
            // Simple conversion from old format to RRULE format
            const frequency = update.frequency || 'DAILY';
            const interval = update.interval || 1;
            
            // If there are specific days, add them to the rule
            let byDayPart = '';
            if (update.repeat_days && update.repeat_days.length > 0) {
              // Convert day names to two-letter abbreviations: MO, TU, WE, TH, FR, SA, SU
              const dayMap: Record<string, string> = {
                'Monday': 'MO', 'Tuesday': 'TU', 'Wednesday': 'WE', 'Thursday': 'TH',
                'Friday': 'FR', 'Saturday': 'SA', 'Sunday': 'SU'
              };
              
              const days = update.repeat_days
                .map(day => dayMap[day] || day)
                .join(',');
                
              byDayPart = `;BYDAY=${days}`;
            }
            
            recurrenceRule = `FREQ=${frequency};INTERVAL=${interval}${byDayPart}`;
          }
          
          await supabase.from('schedule_items').insert({
            user_id: user.id,
            title: update.title,
            start_time: startTimestamp,
            end_time: endTimestamp,
            all_day: update.all_day || false,
            priority: update.priority,
            description: update.description,
            recurrence_rule: recurrenceRule,
          });
        } catch (parseError) {
          console.error('Error parsing date/time:', parseError, 'for input:', { date: dateStr, time: startTimeStr });
          throw new Error(`Failed to parse date/time: ${dateStr} ${startTimeStr}`);
        }
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
        .order('start_time', { ascending: true });
        
      if (error) throw error;
      
      // Process the data for display
      return (data || []).map(item => {
        // Convert timestamps to date strings and time strings
        const startDate = new Date(item.start_time);
        const endDate = new Date(item.end_time);
        
        // Format date for display (YYYY-MM-DD)
        // Using local date to ensure it shows correctly in user's timezone
        const year = startDate.getFullYear();
        const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
        const day = startDate.getDate().toString().padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        // Format the start time for display (12-hour format)
        let startHours = startDate.getHours();
        const startMinutes = startDate.getMinutes();
        const startAmpm = startHours >= 12 ? 'PM' : 'AM';
        startHours = startHours % 12;
        startHours = startHours ? startHours : 12; // Convert 0 to 12
        const startTimeStr = `${startHours}:${startMinutes.toString().padStart(2, '0')} ${startAmpm}`;
        
        // Format the end time for display (12-hour format)
        let endHours = endDate.getHours();
        const endMinutes = endDate.getMinutes();
        const endAmpm = endHours >= 12 ? 'PM' : 'AM';
        endHours = endHours % 12;
        endHours = endHours ? endHours : 12; // Convert 0 to 12
        const endTimeStr = `${endHours}:${endMinutes.toString().padStart(2, '0')} ${endAmpm}`;
        
        // Parse recurrence rule if present
        let recurring = false;
        let frequency = null;
        let repeatDays = null;
        
        if (item.recurrence_rule) {
          recurring = true;
          const ruleParts = item.recurrence_rule.split(';');
          
          // Extract frequency (e.g., "FREQ=DAILY" -> "DAILY")
          const freqPart = ruleParts.find((p: string) => p.startsWith('FREQ='));
          if (freqPart) {
            frequency = freqPart.split('=')[1];
          }
          
          // Extract days (e.g., "BYDAY=MO,WE,FR" -> ["Monday", "Wednesday", "Friday"])
          const bydayPart = ruleParts.find((p: string) => p.startsWith('BYDAY='));
          if (bydayPart) {
            const dayAbbrs = bydayPart.split('=')[1].split(',');
            const dayMap: Record<string, string> = {
              'MO': 'Monday', 'TU': 'Tuesday', 'WE': 'Wednesday', 'TH': 'Thursday',
              'FR': 'Friday', 'SA': 'Saturday', 'SU': 'Sunday'
            };
            repeatDays = dayAbbrs.map((abbr: string) => dayMap[abbr] || abbr);
          }
        }
        
        return {
          id: item.id,
          title: item.title,
          date: dateStr,
          start_time: startTimeStr,
          end_time: endTimeStr,
          description: item.description,
          priority: item.priority,
          all_day: item.all_day,
          recurring,
          frequency,
          repeat_days: repeatDays,
          recurrence_rule: item.recurrence_rule,
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