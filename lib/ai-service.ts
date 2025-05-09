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
  goalsUpdates: GoalUpdate[];
  bioUpdate?: string;
  thoughts?: string;
  sessionId: string;
}

export interface AgentRequest {
  query: string;
  userId: string;
  chatHistory: ChatMessage[];
  sessionId: string;
  currentDate?: string; // ISO format date string (YYYY-MM-DD)
  currentTime?: string; // Time in HH:MM format
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
  type: 'task' | 'event';  // Distinguish between tasks and events
}

export interface IdeaUpdate {
  id?: string;
  user_id?: string;
  content: string;
}

export interface GoalUpdate {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  target_date: string;  // ISO date string (YYYY-MM-DD)
  progress?: number;  // 0-100 percentage
  category?: string;
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
      
      // Get current date in ISO format (YYYY-MM-DD)
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Get current time in HH:MM format
      const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 5);
      
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
          sessionId,
          currentDate,
          currentTime
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
      
      if (data.goalsUpdates?.length > 0) {
        try {
          // Apply goal updates to database
          await DatabaseService.saveGoals(data.goalsUpdates);
        } catch (error) {
          console.error('Error saving goal updates:', error);
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