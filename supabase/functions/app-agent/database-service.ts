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
    // Process the data for display
    return (data || []).map((item: any)=>{
      // Convert timestamp to date string and time string
      const startDate = new Date(item.start_time);
      const endDate = new Date(item.end_time);
      
      // Format the start time for display (12-hour format)
      const startTimeStr = startDate.toLocaleTimeString('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Format the end time for display (12-hour format)
      const endTimeStr = endDate.toLocaleTimeString('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
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
    // Validate required fields
    if (!item.start_time) {
      console.error('Start time is required for schedule items');
      return null;
    }

    // If end_time is not provided, set it to 1 hour after start_time
    if (!item.end_time) {
      const startDate = new Date(item.start_time);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
      item.end_time = endDate.toISOString();
    }

    // Convert time strings to ISO timestamps
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    console.log('item.start_time', item.start_time);
    console.log('item.end_time', item.end_time);
    
    // Parse hours and minutes from the time strings
    const [startHours, startMinutes] = parseTimeString(item.start_time);
    const [endHours, endMinutes] = parseTimeString(item.end_time);
    
    // Create date objects
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startHours, startMinutes);
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endHours, endMinutes);
    
    // Ensure the dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error(`Invalid date created from: ${todayStr} ${item.start_time} / ${item.end_time}`);
      return null;
    }
    
    // Ensure end time is after start time
    if (endDate <= startDate) {
      console.error('End time must be after start time');
      return null;
    }
    
    // Convert to ISO string for storage in the database
    const startTimestamp = startDate.toISOString();
    const endTimestamp = endDate.toISOString();
    
    // Create a new schedule item
    const { data, error } = await supabase.from('schedule_items').insert({
      user_id: item.user_id,
      title: item.title,
      start_time: startTimestamp,
      end_time: endTimestamp,
      description: item.description,
      priority: item.priority,
      all_day: item.all_day,
      recurrence_rule: item.recurrence_rule
    }).select();
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

// Helper function to parse time string
function parseTimeString(timeStr: string): [number, number] {
  let hours = 12;
  let minutes = 0;

  console.log('timeStr', timeStr);
  
  if (timeStr.includes(':')) {
    // Handle formats like "3:00 PM" or "15:00"
    let [hourStr, minuteStr] = timeStr.split(':');
    
    // Extract only numbers from minute string
    minuteStr = minuteStr.replace(/[^\d]/g, '');
    
    hours = parseInt(hourStr);
    minutes = parseInt(minuteStr);
    
    // Handle AM/PM if present
    const isPM = timeStr.toLowerCase().includes('pm');
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12 && timeStr.toLowerCase().includes('am')) hours = 0;
  } else if (/^\d+$/.test(timeStr)) {
    // Handle numeric time like "1500" for 15:00
    const timeNum = parseInt(timeStr);
    hours = Math.floor(timeNum / 100);
    minutes = timeNum % 100;
  }
  
  // Validate hours and minutes
  if (isNaN(hours) || hours < 0 || hours > 23) hours = 12;
  if (isNaN(minutes) || minutes < 0 || minutes > 59) minutes = 0;
  
  return [hours, minutes];
} 