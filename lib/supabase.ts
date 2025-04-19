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
  created_at: string;
  updated_at: string;
};

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type ScheduleItem = {
  id: string;
  user_id: string;
  title: string;
  time: string;
  date?: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  duration?: number; // Duration in minutes
  recurring?: 'daily' | 'weekly' | 'monthly' | null;
  repeat_days?: DayOfWeek[]; // Specific days to repeat on
  created_at: string;
  updated_at: string;
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