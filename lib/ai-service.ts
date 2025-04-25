/**
 * Client-side service for AI interactions
 * Communicates with the server-side API endpoint to keep API keys secure
 */

'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { DatabaseService } from '@/lib/database-service';

// Types for API responses and requests
export interface AgentResponse {
  message: string;
  scheduleUpdates: ScheduleUpdate[];
  ideasUpdates: IdeaUpdate[];
  habitsUpdates: HabitUpdate[];
  bioUpdate?: string;
  thoughts?: string;
  sessionId: string;
}

export interface AgentRequest {
  query: string;
  userId: string;
  chatHistory: ChatMessage[];
  sessionId: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface ScheduleUpdate {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  start_time?: string;  // Time in 24-hour format (HH:mm)
  end_time?: string;  // Time in 24-hour format (HH:mm)
  all_day?: boolean;  // Whether it's an all-day event
  recurrence_rule?: string;  // iCal RRULE string
}

export interface IdeaUpdate {
  id?: string;
  user_id?: string;
  content: string;
}

export interface HabitUpdate {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  frequency?: string;
  type?: string;
  target_days?: string[];
  streak?: number;
}

// AI Service for communicating with the edge function
export const AIService = {
  /**
   * Send a query to the AI agent and return its response
   */
  async sendQuery(
    query: string,
    chatHistory: ChatMessage[],
    sessionId: string
  ): Promise<AgentResponse> {
    const supabase = createClientComponentClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Get session for the token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No valid session token');
      }
      
      // Call the edge function
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/app-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          userId: user.id,
          chatHistory,
          sessionId
        } as AgentRequest)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get agent response');
      }
      
      const data = await response.json();
      
      // Process the data if needed (e.g., handle date/time conversions)
      if (data.scheduleUpdates?.length > 0) {
        try {
          // Apply schedule updates to database
          await DatabaseService.saveScheduleItems(data.scheduleUpdates);
        } catch (error) {
          console.error('Error saving schedule updates:', error);
        }
      }
      
      if (data.ideasUpdates?.length > 0) {
        try {
          // Apply idea updates to database
          await DatabaseService.saveIdeas(data.ideasUpdates);
        } catch (error) {
          console.error('Error saving idea updates:', error);
        }
      }
      
      if (data.habitsUpdates?.length > 0) {
        try {
          // Apply habit updates to database
          await DatabaseService.saveHabits(data.habitsUpdates);
        } catch (error) {
          console.error('Error saving habit updates:', error);
        }
      }
      
      if (data.bioUpdate) {
        try {
          // Apply bio update to database
          await DatabaseService.updateUserBio(data.bioUpdate);
        } catch (error) {
          console.error('Error saving bio update:', error);
        }
      }
      
      return data as AgentResponse;
    } catch (error) {
      console.error('Error in AI Service:', error);
      throw error;
    }
  }
};

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