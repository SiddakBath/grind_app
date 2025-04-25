import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";
import OpenAI from 'npm:openai@4.12.1';
import { corsHeaders } from './cors-headers.ts';
import { DatabaseService } from './database-service.ts';
import { functionDefinitions } from './function-definitions.ts';

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
    const { query, userId, chatHistory, sessionId } = await req.json();
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
            user_id: userId,
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
            user_id: userId,
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
      error: error instanceof Error ? error.message : 'An error occurred processing your request'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
