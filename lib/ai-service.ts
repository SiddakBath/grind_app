/**
 * Client-side service for AI interactions
 * Communicates with the server-side API endpoint to keep API keys secure
 */

import { DayOfWeek } from '@/lib/supabase';

export interface ScheduleUpdate {
  title: string;
  date: string;
  time: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  duration?: number; // Duration in minutes
  recurring?: 'daily' | 'weekly' | 'monthly' | null;
  repeat_days?: DayOfWeek[]; // Specific days to repeat on
}

export interface IdeaUpdate {
  title?: string;
  content: string;
}

export interface HabitUpdate {
  title: string;
  frequency?: string;
  type?: 'daily' | 'weekly' | 'monthly';
}

type AIResponse = {
  message: string;
  scheduleUpdates?: ScheduleUpdate[];
  ideasUpdates?: IdeaUpdate[];
  habitsUpdates?: HabitUpdate[];
};

type APIErrorResponse = {
  error: string;
};

/**
 * Get response from GPT-4 for user queries via server API
 */
export async function getAiResponse(query: string): Promise<AIResponse> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorData = await response.json() as APIErrorResponse;
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Validate the response structure
    return {
      message: typeof data.message === 'string' ? data.message : "I've processed your request.",
      scheduleUpdates: Array.isArray(data.scheduleUpdates) ? data.scheduleUpdates : [],
      ideasUpdates: Array.isArray(data.ideasUpdates) ? data.ideasUpdates : [],
      habitsUpdates: Array.isArray(data.habitsUpdates) ? data.habitsUpdates : []
    };
  } catch (error) {
    console.error('Error calling AI API:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get AI response');
  }
}

/**
 * Legacy simulation function - keeping for fallback
 */
export async function simulateAiResponse(query: string): Promise<void> {
  // Simulate network latency
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`AI received query: ${query}`);
      resolve();
    }, 1000);
  });
}