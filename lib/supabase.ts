import { createClient } from '@supabase/supabase-js';

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  bio?: string;
  created_at: string;
  updated_at: string;
};

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type ScheduleItem = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  start_time: string;  // Timestamp
  end_time: string;    // Timestamp
  all_day: boolean;
  recurrence_rule: string | null;  // iCal RRULE format
  created_at: string;
  updated_at: string;
  
  // Computed fields for display purposes
  start_time_display?: string;  // HH:MM AM/PM format
  end_time_display?: string;    // HH:MM AM/PM format
};

export type Idea = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type Resource = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  type: 'article' | 'document' | 'link';
  created_at: string;
  updated_at: string;
};