import { SupabaseClient } from "npm:@supabase/supabase-js@2.38.4";

// Define interfaces for the database models
interface ScheduleItem {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  priority?: string;
  all_day?: boolean;
  recurrence_rule?: string;
  date?: string;
  recurring?: boolean;
  repeat_days?: string[];
  frequency?: string;
  interval?: number;
}

interface Idea {
  id?: string;
  user_id: string;
  content: string;
  title?: string;
}

interface Habit {
  id?: string;
  user_id: string;
  title: string;
  frequency?: string;
  type?: string;
  description?: string;
  target_days?: string[];
  streak?: number;
}

// Database service functions that match the actual schema
export const DatabaseService = {
  async getScheduleItems (supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.from('schedule_items').select('*').eq('user_id', userId).order('start_time', {
      ascending: true
    });
    if (error) {
      console.error('Error fetching schedule items:', error);
      return [];
    }
    // Process the data for display as in the database-service.ts
    return (data || []).map((item: any)=>{
      // Convert timestamp to date string and time string
      const startDate = new Date(item.start_time);
      const endDate = new Date(item.end_time);
      
      // Format date for display (YYYY-MM-DD)
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
      let repeatDays = null;
      
      if (item.recurrence_rule) {
        recurring = true;
        const ruleParts = item.recurrence_rule.split(';');
        
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
        ...item,
        date: dateStr,
        start_time: startTimeStr,
        end_time: endTimeStr,
        recurring,
        repeat_days: repeatDays
      };
    });
  },
  async getIdeas (supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.from('ideas').select('*').eq('user_id', userId).order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching ideas:', error);
      return [];
    }
    return data || [];
  },
  async getHabits (supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.from('habits').select('*').eq('user_id', userId).order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching habits:', error);
      return [];
    }
    return data || [];
  },
  async getUserBio (supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.from('profiles').select('bio').eq('id', userId).single();
    if (error) {
      console.error('Error fetching user bio:', error);
      return null;
    }
    return data?.bio || '';
  },
  async updateUserBio (supabase: SupabaseClient, userId: string, bio: string) {
    const { data, error } = await supabase.from('profiles').update({ bio }).eq('id', userId).select().single();
    if (error) {
      console.error('Error updating user bio:', error);
      return null;
    }
    return data;
  },
  async saveScheduleItem (supabase: SupabaseClient, item: ScheduleItem) {
    // Process date and time if provided separately
    if (item.date) {
      const dateStr = item.date;
      const startTimeStr = item.start_time || "12:00";
      const endTimeStr = item.end_time || item.start_time ? (item.start_time + " +1 hour") : "13:00";
      
      // Parse date components
      const [year, month, day] = dateStr.split('-').map(Number);
      
      // Parse start time components
      let startHour = 0;
      let startMinute = 0;
      
      // Handle different time formats for start time
      if (startTimeStr.includes(':')) {
        // Format like "3:00 PM" or "15:00"
        let [hourStr, minuteStr] = startTimeStr.split(':');
        // Extract only numbers from minute string
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
          // Default time
          startHour = 12;
          startMinute = 0;
        }
      }
      
      // Parse end time components or default to start time + 1 hour
      let endHour = startHour + 1;
      let endMinute = startMinute;
      
      if (endTimeStr && endTimeStr !== (startTimeStr + " +1 hour")) {
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
      
      // Make sure end time is after start time
      if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
        endHour = startHour + 1;
        endMinute = startMinute;
      }
      
      // Create date objects in local timezone
      const startDate = new Date(year, month - 1, day, startHour, startMinute);
      const endDate = new Date(year, month - 1, day, endHour, endMinute);
      
      // Convert to ISO string for storage
      item.start_time = startDate.toISOString();
      item.end_time = endDate.toISOString();
    }
    
    // Convert recurrence information
    if (item.recurring) {
      // Simple conversion from old format to RRULE format
      const frequency = item.frequency || 'DAILY';
      const interval = item.interval || 1;
      
      // If there are specific days, add them to the rule
      let byDayPart = '';
      if (item.repeat_days && item.repeat_days.length > 0) {
        // Convert day names to two-letter abbreviations: MO, TU, WE, TH, FR, SA, SU
        const dayMap: Record<string, string> = {
          'Monday': 'MO', 'Tuesday': 'TU', 'Wednesday': 'WE', 'Thursday': 'TH',
          'Friday': 'FR', 'Saturday': 'SA', 'Sunday': 'SU'
        };
        
        const days = item.repeat_days
          .map((day: string) => dayMap[day] || day)
          .join(',');
          
        byDayPart = `;BYDAY=${days}`;
      }
      
      item.recurrence_rule = `FREQ=${frequency};INTERVAL=${interval}${byDayPart}`;
      
      // Remove old fields that are now part of recurrence_rule
      delete item.recurring;
      delete item.repeat_days;
      delete item.frequency;
      delete item.interval;
    }
    
    // Prepare the item for database insertion/update
    const scheduleItem = {
      user_id: item.user_id,
      title: item.title,
      start_time: item.start_time,
      end_time: item.end_time,
      description: item.description,
      priority: item.priority,
      all_day: item.all_day || false,
      recurrence_rule: item.recurrence_rule
    };
    
    // If ID exists, update, otherwise insert
    const operation = item.id ? supabase.from('schedule_items').update(scheduleItem).eq('id', item.id) : supabase.from('schedule_items').insert(scheduleItem);
    const { data, error } = await operation.select().single();
    if (error) {
      console.error('Error saving schedule item:', error);
      return null;
    }
    return data;
  },
  async saveIdea (supabase: SupabaseClient, idea: Idea) {
    // Prepare idea for database
    const ideaItem = {
      user_id: idea.user_id,
      content: idea.content || idea.title // Support both content and title fields
    };
    // If ID exists, update, otherwise insert
    const operation = idea.id ? supabase.from('ideas').update(ideaItem).eq('id', idea.id) : supabase.from('ideas').insert(ideaItem);
    const { data, error } = await operation.select().single();
    if (error) {
      console.error('Error saving idea:', error);
      return null;
    }
    return data;
  },
  async saveHabit (supabase: SupabaseClient, habit: Habit) {
    // Prepare habit for database
    const habitItem = {
      user_id: habit.user_id,
      title: habit.title,
      frequency: habit.frequency || 'Daily',
      type: habit.type || 'daily',
      description: habit.description,
      target_days: habit.target_days,
      streak: habit.streak || 0
    };
    // If ID exists, update, otherwise insert
    const operation = habit.id ? supabase.from('habits').update(habitItem).eq('id', habit.id) : supabase.from('habits').insert(habitItem);
    const { data, error } = await operation.select().single();
    if (error) {
      console.error('Error saving habit:', error);
      return null;
    }
    return data;
  },
  async deleteScheduleItem (supabase: SupabaseClient, itemId: string) {
    const { error } = await supabase.from('schedule_items').delete().eq('id', itemId);
    if (error) {
      console.error('Error deleting schedule item:', error);
      return false;
    }
    return true;
  },
  async deleteIdea (supabase: SupabaseClient, ideaId: string) {
    const { error } = await supabase.from('ideas').delete().eq('id', ideaId);
    if (error) {
      console.error('Error deleting idea:', error);
      return false;
    }
    return true;
  },
  async deleteHabit (supabase: SupabaseClient, habitId: string) {
    const { error } = await supabase.from('habits').delete().eq('id', habitId);
    if (error) {
      console.error('Error deleting habit:', error);
      return false;
    }
    return true;
  }
}; 