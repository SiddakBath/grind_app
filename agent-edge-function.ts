import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.38.4";
import OpenAI from 'npm:openai@4.12.1';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// Database service functions that match the actual schema
const DatabaseService = {
  async getScheduleItems (supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase.from('schedule_items').select('*').eq('user_id', userId).order('start_time', {
      ascending: true
    });
    if (error) {
      console.error('Error fetching schedule items:', error);
      return [];
    }
    // Process the data for display as in the database-service.ts
    return (data || []).map((item)=>{
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
        const bydayPart = ruleParts.find(p => p.startsWith('BYDAY='));
        if (bydayPart) {
          const dayAbbrs = bydayPart.split('=')[1].split(',');
          const dayMap = {
            'MO': 'Monday', 'TU': 'Tuesday', 'WE': 'Wednesday', 'TH': 'Thursday',
            'FR': 'Friday', 'SA': 'Saturday', 'SU': 'Sunday'
          };
          repeatDays = dayAbbrs.map(abbr => dayMap[abbr] || abbr);
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
  async saveScheduleItem (supabase: SupabaseClient, item: any) {
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
        const dayMap = {
          'Monday': 'MO', 'Tuesday': 'TU', 'Wednesday': 'WE', 'Thursday': 'TH',
          'Friday': 'FR', 'Saturday': 'SA', 'Sunday': 'SU'
        };
        
        const days = item.repeat_days
          .map(day => dayMap[day] || day)
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
  async saveIdea (supabase: SupabaseClient, idea: any) {
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
  async saveHabit (supabase: SupabaseClient, habit: any) {
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
// Define function schemas for OpenAI function calling
const functionDefinitions = [
  {
    name: 'get_schedule_items',
    description: 'Retrieve the user\'s schedule items',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_ideas',
    description: 'Retrieve the user\'s ideas',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_habits',
    description: 'Retrieve the user\'s habits',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_user_bio',
    description: 'Retrieve the user\'s biography/profile information',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'update_user_bio',
    description: 'Update the user\'s biography based on new information',
    parameters: {
      type: 'object',
      properties: {
        bio: {
          type: 'string',
          description: 'The updated biography text for the user'
        }
      },
      required: [
        'bio'
      ]
    }
  },
  {
    name: 'create_schedule_item',
    description: 'Create a new schedule item or event for the user',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the schedule item'
        },
        description: {
          type: 'string',
          description: 'Optional description of the schedule item'
        },
        date: {
          type: 'string',
          description: 'Date in format YYYY-MM-DD'
        },
        start_time: {
          type: 'string',
          description: 'Start time in format HH:MM or h:MM AM/PM'
        },
        end_time: {
          type: 'string',
          description: 'End time in format HH:MM or h:MM AM/PM. If not provided, defaults to 1 hour after start time'
        },
        priority: {
          type: 'string',
          enum: [
            'low',
            'medium',
            'high'
          ],
          description: 'Priority level of the task'
        },
        all_day: {
          type: 'boolean',
          description: 'Whether this is an all-day event'
        },
        recurrence_rule: {
          type: 'string',
          description: 'iCal RRULE string like "FREQ=DAILY;INTERVAL=1"'
        },
        recurring: {
          type: 'boolean',
          description: 'DEPRECATED: Whether this is a recurring event. Use recurrence_rule instead.'
        },
        frequency: {
          type: 'string',
          description: 'DEPRECATED: Frequency for recurring events (daily/weekly/monthly/yearly). Use recurrence_rule instead.'
        },
        interval: {
          type: 'number',
          description: 'DEPRECATED: Interval for recurring events. Use recurrence_rule instead.'
        },
        repeat_days: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'DEPRECATED: Days of the week for recurring events. Use recurrence_rule instead.'
        }
      },
      required: [
        'title',
        'date',
        'start_time'
      ]
    }
  },
  {
    name: 'update_schedule_item',
    description: 'Update an existing schedule item',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the schedule item to update'
        },
        title: {
          type: 'string',
          description: 'Updated title'
        },
        description: {
          type: 'string',
          description: 'Updated description'
        },
        date: {
          type: 'string',
          description: 'Updated date in format YYYY-MM-DD'
        },
        start_time: {
          type: 'string',
          description: 'Updated start time in format HH:MM or h:MM AM/PM'
        },
        end_time: {
          type: 'string',
          description: 'Updated end time in format HH:MM or h:MM AM/PM'
        },
        priority: {
          type: 'string',
          enum: [
            'low',
            'medium',
            'high'
          ],
          description: 'Updated priority level'
        },
        all_day: {
          type: 'boolean',
          description: 'Whether this is an all-day event'
        },
        recurrence_rule: {
          type: 'string',
          description: 'iCal RRULE string like "FREQ=DAILY;INTERVAL=1"'
        },
        recurring: {
          type: 'boolean',
          description: 'DEPRECATED: Whether this is a recurring event. Use recurrence_rule instead.'
        },
        frequency: {
          type: 'string',
          description: 'DEPRECATED: Frequency for recurring events. Use recurrence_rule instead.'
        },
        interval: {
          type: 'number',
          description: 'DEPRECATED: Interval for recurring events. Use recurrence_rule instead.'
        },
        repeat_days: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'DEPRECATED: Days of the week for recurring events. Use recurrence_rule instead.'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'create_idea',
    description: 'Create a new idea for the user',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The content of the idea'
        }
      },
      required: [
        'content'
      ]
    }
  },
  {
    name: 'update_idea',
    description: 'Update an existing idea',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the idea to update'
        },
        content: {
          type: 'string',
          description: 'Updated content'
        }
      },
      required: [
        'id',
        'content'
      ]
    }
  },
  {
    name: 'create_habit',
    description: 'Create a new habit for the user',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the habit'
        },
        description: {
          type: 'string',
          description: 'Description of the habit'
        },
        frequency: {
          type: 'string',
          description: 'How often the habit should be performed (e.g., "daily", "weekly")'
        },
        type: {
          type: 'string',
          description: 'Type of habit (e.g., "health", "productivity")'
        },
        target_days: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Days of the week for the habit (e.g., ["Monday", "Wednesday", "Friday"])'
        }
      },
      required: [
        'title'
      ]
    }
  },
  {
    name: 'update_habit',
    description: 'Update an existing habit',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the habit to update'
        },
        title: {
          type: 'string',
          description: 'Updated title'
        },
        description: {
          type: 'string',
          description: 'Updated description'
        },
        frequency: {
          type: 'string',
          description: 'Updated frequency'
        },
        type: {
          type: 'string',
          description: 'Updated type'
        },
        streak: {
          type: 'number',
          description: 'Updated streak count'
        },
        target_days: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Updated days of the week for the habit'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'delete_schedule_item',
    description: 'Delete a schedule item',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the schedule item to delete'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'delete_idea',
    description: 'Delete an idea',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the idea to delete'
        }
      },
      required: [
        'id'
      ]
    }
  },
  {
    name: 'delete_habit',
    description: 'Delete a habit',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the habit to delete'
        }
      },
      required: [
        'id'
      ]
    }
  }
];
// Deno edge function handler
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400", // Cache preflight response for 24h
      },
    });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';
    // Parse request body
    const requestData = await req.json();
    const { query, userId, chatHistory, sessionId } = requestData;
    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });
    // Initialize response data
    let scheduleUpdates = [];
    let ideasUpdates = [];
    let habitsUpdates = [];
    let scheduleDeletions = [];
    let ideasDeletions = [];
    let habitsDeletions = [];
    let bioUpdate = null;
    let userBio = '';
    let finalResponseMessage = '';
    // Data fetched from the database
    let scheduleItems = [];
    let ideas = [];
    let habits = [];
    // Create a system message with context
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 5);
    const systemMessage = {
      role: 'system',
      content: `You are a helpful personal assistant that helps users manage their schedule, ideas, and habits.
Today's date is ${currentDate} and the current time is ${currentTime}.

User information:
- User ID: ${userId}

You should help the user by retrieving their data as needed and updating it through function calls.
Always follow the ReAct approach:
1. Reason about what the user is asking for and what data you need to retrieve
2. Act by making appropriate function calls to get or update data
3. Generate a natural, conversational response to the user

IMPORTANT: You must maintain and use the user's biographical information to provide personalized assistance:
1. At the start of each conversation, fetch the user's bio with get_user_bio
2. Use this information to understand the user's preferences, goals, schedule patterns, and interests
3. Continuously update the bio as you learn new information about the user
4. Base your suggestions for schedule items, ideas, and habits on this bio
5. When updating the bio, include key information like:
   - User's goals and priorities
   - Preferred schedules, routines and working hours
   - Interests, hobbies, and activities
   - Important recurring events
   - Constraints and preferences (e.g., prefers morning workouts)
   - Important relationships and commitments
6. DO NOT ask the user to update their bio. You should automatically update it as you learn new information about the user.
7. DO NOT inform the user that you are updating their bio. This is internal to the system.

First, if you need to know about the user's schedule, ideas, or habits, retrieve that data with get_schedule_items, get_ideas, or get_habits.
If the user wants to create or update items, use the appropriate create or update function calls.
If the user wants to delete items, use the appropriate delete function calls (delete_schedule_item, delete_idea, delete_habit).
Be friendly, helpful, and personable in your responses.

When creating schedule items, make sure to include:
- title: Name of the event (required)
- date: Date in YYYY-MM-DD format (required)
- start_time: Start time in HH:MM or h:MM AM/PM format (required)
- end_time: End time in same format (if not provided, defaults to 1 hour after start)
- all_day: true/false for full-day events
- For recurring events, use recurrence_rule with appropriate RRULE format.

For recurring events, use the recurrence_rule field with iCal RRULE format:
- Daily: "FREQ=DAILY;INTERVAL=1"
- Weekly on specific days: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR"
- Monthly: "FREQ=MONTHLY;INTERVAL=1"
- Yearly: "FREQ=YEARLY;INTERVAL=1"

The interval value indicates how often the event repeats (1=every, 2=every other, etc.)
The BYDAY parameter can include: MO, TU, WE, TH, FR, SA, SU

CRITICAL: When deleting items, always use the specific delete functions (delete_schedule_item, delete_idea, delete_habit) rather than trying to update them to a deleted state. This ensures proper tracking and UI updates.`
    };
    // Convert chat history to ChatGPT format
    const messages = [
      systemMessage,
      ...chatHistory,
      {
        role: 'user',
        content: query
      }
    ];
    // Implementation of ReAct loop
    const maxIterations = 5; // Increased for data retrieval
    let iterations = 0;
    let shouldContinue = true;
    let thoughts = '';
    while(shouldContinue && iterations < maxIterations){
      // Call OpenAI with the current messages and function definitions
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages,
        functions: functionDefinitions,
        function_call: 'auto',
        temperature: 0.7
      });
      const responseChoice = response.choices[0];
      const responseMessage = responseChoice.message;
      // Add the assistant's thinking to our thought log
      if (responseMessage.content) {
        thoughts += responseMessage.content + '\n';
        messages.push(responseMessage);
        finalResponseMessage = responseMessage.content;
      }
      // Check if there's a function call
      if (responseMessage.function_call) {
        const functionName = responseMessage.function_call.name;
        const functionArgs = functionName.startsWith('get_') ? {} : JSON.parse(responseMessage.function_call.arguments);
        // Handle function calls for data retrieval and updates
        if (functionName === 'get_schedule_items') {
          // Fetch schedule items from the database
          scheduleItems = await DatabaseService.getScheduleItems(supabase, userId);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: true,
              scheduleItems: scheduleItems,
              count: scheduleItems.length
            })
          });
        } else if (functionName === 'get_ideas') {
          // Fetch ideas from the database
          ideas = await DatabaseService.getIdeas(supabase, userId);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: true,
              ideas: ideas,
              count: ideas.length
            })
          });
        } else if (functionName === 'get_habits') {
          // Fetch habits from the database
          habits = await DatabaseService.getHabits(supabase, userId);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: true,
              habits: habits,
              count: habits.length
            })
          });
        } else if (functionName === 'get_user_bio') {
          const userBioResult = await DatabaseService.getUserBio(supabase, userId);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: true,
              bio: userBioResult
            })
          });
          // Store the user bio in the variable for later reference
          userBio = userBioResult || '';
        } else if (functionName === 'update_user_bio') {
          const updatedBio = await DatabaseService.updateUserBio(supabase, userId, functionArgs.bio);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!updatedBio,
              bio: updatedBio
            })
          });
          // Update the bioUpdate variable to include it in the response
          bioUpdate = functionArgs.bio;
        } else if (functionName === 'create_schedule_item') {
          const newItem = {
            ...functionArgs,
            user_id: userId
          };
          const savedItem = await DatabaseService.saveScheduleItem(supabase, newItem);
          if (savedItem) {
            scheduleUpdates.push(savedItem);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!savedItem,
              item: savedItem
            })
          });
        } else if (functionName === 'update_schedule_item') {
          const updateItem = {
            ...functionArgs,
            user_id: userId
          };
          const savedItem = await DatabaseService.saveScheduleItem(supabase, updateItem);
          if (savedItem) {
            scheduleUpdates.push(savedItem);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!savedItem,
              item: savedItem
            })
          });
        } else if (functionName === 'create_idea') {
          const newIdea = {
            ...functionArgs,
            user_id: userId
          };
          const savedIdea = await DatabaseService.saveIdea(supabase, newIdea);
          if (savedIdea) {
            ideasUpdates.push(savedIdea);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!savedIdea,
              idea: savedIdea
            })
          });
        } else if (functionName === 'update_idea') {
          const updateIdea = {
            ...functionArgs,
            user_id: userId
          };
          const savedIdea = await DatabaseService.saveIdea(supabase, updateIdea);
          if (savedIdea) {
            ideasUpdates.push(savedIdea);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!savedIdea,
              idea: savedIdea
            })
          });
        } else if (functionName === 'create_habit') {
          const newHabit = {
            ...functionArgs,
            user_id: userId
          };
          const savedHabit = await DatabaseService.saveHabit(supabase, newHabit);
          if (savedHabit) {
            habitsUpdates.push(savedHabit);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!savedHabit,
              habit: savedHabit
            })
          });
        } else if (functionName === 'update_habit') {
          const updateHabit = {
            ...functionArgs,
            user_id: userId
          };
          const savedHabit = await DatabaseService.saveHabit(supabase, updateHabit);
          if (savedHabit) {
            habitsUpdates.push(savedHabit);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!savedHabit,
              habit: savedHabit
            })
          });
        } else if (functionName === 'delete_schedule_item') {
          const deleted = await DatabaseService.deleteScheduleItem(supabase, functionArgs.id);
          if (deleted) {
            scheduleDeletions.push(functionArgs.id);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: deleted
            })
          });
        } else if (functionName === 'delete_idea') {
          const deleted = await DatabaseService.deleteIdea(supabase, functionArgs.id);
          if (deleted) {
            ideasDeletions.push(functionArgs.id);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: deleted
            })
          });
        } else if (functionName === 'delete_habit') {
          const deleted = await DatabaseService.deleteHabit(supabase, functionArgs.id);
          if (deleted) {
            habitsDeletions.push(functionArgs.id);
          }
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: deleted
            })
          });
        }
        // Continue the loop
        iterations++;
      } else {
        // No function call, so we're done with this iteration
        shouldContinue = false;
        finalResponseMessage = responseMessage.content || '';
      }
    }
    // Get final response if none yet
    if (!finalResponseMessage) {
      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          ...messages,
          {
            role: 'system',
            content: 'Now provide a final conversational response to the user that summarizes any actions you took and answers their query naturally.'
          }
        ],
        temperature: 0.7
      });
      finalResponseMessage = finalResponse.choices[0].message.content || '';
    }
    // Return the final response
    return new Response(JSON.stringify({
      message: finalResponseMessage,
      scheduleUpdates,
      ideasUpdates,
      habitsUpdates,
      scheduleDeletions,
      ideasDeletions,
      habitsDeletions,
      bioUpdate,
      thoughts,
      sessionId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in agent edge function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'An error occurred processing your request'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
