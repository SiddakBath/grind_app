import { SupabaseClient } from "npm:@supabase/supabase-js@2.38.4";

// Define interfaces for the database models
interface ScheduleItem {
  id?: string;
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

interface Goal {
  id?: string;
  user_id: string;
  title: string;
  description?: string;
  target_date: string;  // ISO date string (YYYY-MM-DD)
  progress?: number;    // 0-100 percentage
  category?: string;    // Category for organizing goals
}

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
  async getGoals (supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).order('target_date', {
      ascending: true
    });
    if (error) {
      console.error('Error fetching goals:', error);
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
    // For updates, we only need the id
    if (item.id) {
      // This is an update operation
      const updateData: any = {};
      
      // Only include fields that are provided
      if (item.title) updateData.title = item.title;
      if (item.description !== undefined) updateData.description = item.description;
      if (item.priority) updateData.priority = item.priority;
      if (item.all_day !== undefined) updateData.all_day = item.all_day;
      if (item.recurrence_rule) updateData.recurrence_rule = item.recurrence_rule;
      
      // Handle time fields if provided
      if (item.start_time) {
        // Parse hours and minutes from the time string
        const [startHours, startMinutes] = parseTimeString(item.start_time);
        
        // Create date object
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startHours, startMinutes);
        
        // Ensure the date is valid
        if (!isNaN(startDate.getTime())) {
          updateData.start_time = startDate.toISOString();
        }
      }
      
      if (item.end_time) {
        // Parse hours and minutes from the time string
        const [endHours, endMinutes] = parseTimeString(item.end_time);
        
        // Create date object
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endHours, endMinutes);
        
        // Ensure the date is valid
        if (!isNaN(endDate.getTime())) {
          updateData.end_time = endDate.toISOString();
        }
      }
      
      // Update the schedule item
      const { data, error } = await supabase.from('schedule_items').update(updateData).eq('id', item.id).select('*');
      if (error) {
        console.error('Error updating schedule item:', error);
        return null;
      }
      return data[0] || null;
    } else {
      // This is a create operation
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
      }).select('*');
      if (error) {
        console.error('Error saving schedule item:', error);
        return null;
      }
      return data[0] || null;
    }
  },
  async saveIdea (supabase: SupabaseClient, idea: Idea) {
    // For updates, we only need the id
    if (idea.id) {
      // This is an update operation
      const updateData: any = {};
      
      // Only include fields that are provided
      if (idea.content) updateData.content = idea.content;
      
      // Update the idea
      const { data, error } = await supabase.from('ideas').update(updateData).eq('id', idea.id).select('*');
      if (error) {
        console.error('Error updating idea:', error);
        return null;
      }
      return data[0] || null;
    } else {
      // This is a create operation
      // Create a new idea
      const { data, error } = await supabase.from('ideas').insert({
        user_id: idea.user_id,
        content: idea.content
      }).select('*');
      if (error) {
        console.error('Error creating idea:', error);
        return null;
      }
      return data[0] || null;
    }
  },
  async saveGoal (supabase: SupabaseClient, goal: Goal) {
    // For updates, we only need the id
    if (goal.id) {
      // This is an update operation
      const updateData: any = {};
      
      // Only include fields that are provided
      if (goal.title) updateData.title = goal.title;
      if (goal.description !== undefined) updateData.description = goal.description;
      if (goal.target_date) updateData.target_date = goal.target_date;
      if (goal.progress !== undefined) updateData.progress = goal.progress;
      if (goal.category) updateData.category = goal.category;
      
      // Update the goal
      const { data, error } = await supabase.from('goals').update(updateData).eq('id', goal.id).select('*');
      if (error) {
        console.error('Error updating goal:', error);
        return null;
      }
      return data[0] || null;
    } else {
      // This is a create operation
      // Validate required fields
      if (!goal.target_date) {
        console.error('Target date is required for goals');
        return null;
      }
      
      // Ensure progress is within bounds
      const progress = goal.progress !== undefined ? Math.min(Math.max(goal.progress, 0), 100) : 0;
      
      // Create a new goal
      const { data, error } = await supabase.from('goals').insert({
        user_id: goal.user_id,
        title: goal.title,
        description: goal.description,
        target_date: goal.target_date,
        progress: progress,
        category: goal.category || 'Personal'
      }).select('*');
      if (error) {
        console.error('Error creating goal:', error);
        return null;
      }
      return data[0] || null;
    }
  },
  async deleteScheduleItem (supabase: SupabaseClient, itemId: string) {
    const { data, error } = await supabase.from('schedule_items').delete().eq('id', itemId);
    if (error) {
      console.error('Error deleting schedule item:', error);
      return null;
    }
    return { success: true };
  },
  async deleteIdea (supabase: SupabaseClient, ideaId: string) {
    const { data, error } = await supabase.from('ideas').delete().eq('id', ideaId);
    if (error) {
      console.error('Error deleting idea:', error);
      return null;
    }
    return { success: true };
  },
  async deleteGoal (supabase: SupabaseClient, goalId: string) {
    const { data, error } = await supabase.from('goals').delete().eq('id', goalId);
    if (error) {
      console.error('Error deleting goal:', error);
      return null;
    }
    return { success: true };
  },
  async createResource(
    supabase: any,
    userId: string,
    resource: Omit<Resource, 'id' | 'user_id' | 'created_at' | 'last_accessed'>
  ): Promise<Resource> {
    const { data, error } = await supabase
      .from('resources')
      .insert({
        user_id: userId,
        ...resource,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  async getResources(supabase: any, userId: string): Promise<Resource[]> {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('user_id', userId)
      .order('relevance_score', { ascending: false });

    if (error) throw error;
    return data;
  },
  async updateResource(
    supabase: any,
    userId: string,
    resourceId: string,
    updates: Partial<Omit<Resource, 'id' | 'user_id' | 'created_at'>>
  ): Promise<Resource> {
    const { data, error } = await supabase
      .from('resources')
      .update({
        ...updates,
        last_accessed: new Date().toISOString()
      })
      .eq('id', resourceId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  async deleteResource(
    supabase: any,
    userId: string,
    resourceId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', resourceId)
      .eq('user_id', userId);

    if (error) throw error;
  }
};

function parseTimeString(timeStr: string): [number, number] {
  // Handle various time formats
  let hours = 0;
  let minutes = 0;
  
  // Try to parse time from string
  if (timeStr.includes(':')) {
    // Format: "HH:MM" or "h:MM AM/PM"
    let isPM = false;
    let is24Hour = true;
    
    if (timeStr.toLowerCase().includes('pm')) {
      isPM = true;
      is24Hour = false;
    } else if (timeStr.toLowerCase().includes('am')) {
      is24Hour = false;
    }
    
    // Extract hours and minutes
    const parts = timeStr.split(':');
    hours = parseInt(parts[0], 10);
    
    // Handle minutes and AM/PM designation
    if (parts.length > 1) {
      const minutesPart = parts[1].replace(/[^0-9]/g, '');
      minutes = parseInt(minutesPart, 10);
      
      // Adjust hours for 12-hour format
      if (!is24Hour) {
        if (isPM && hours < 12) {
          hours += 12;
        } else if (!isPM && hours === 12) {
          hours = 0;
        }
      }
    }
  } else {
    // Format: Simple integer for hours, like "10" or "14"
    hours = parseInt(timeStr, 10);
  }
  
  // Default to 0 for invalid values
  if (isNaN(hours)) hours = 0;
  if (isNaN(minutes)) minutes = 0;
  
  // Clamp values to valid ranges
  hours = Math.max(0, Math.min(23, hours));
  minutes = Math.max(0, Math.min(59, minutes));
  
  return [hours, minutes];
} 