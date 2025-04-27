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
    const { query, userId, chatHistory, sessionId, currentDate, currentTime: clientTime } = await req.json();
    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });
    // Initialize response data
    let scheduleUpdates = [];
    let ideasUpdates = [];
    let goalsUpdates = [];
    let scheduleDeletions = [];
    let ideasDeletions = [];
    let goalsDeletions = [];
    let bioUpdate = null;
    let userBio = '';
    let finalResponseMessage = '';
    // Data fetched from the database
    let scheduleItems = [];
    let ideas = [];
    let goals = [];
    // Create a system message with context
    // Use the provided date or fall back to server date if not provided
    const dateToUse = currentDate || new Date().toISOString().split('T')[0];
    const timeToUse = clientTime || new Date().toTimeString().split(' ')[0].slice(0, 5);
    const systemMessage = {
      role: 'system',
      content: `You are an ULTRA-PROACTIVE, fun, and efficient personal assistant that helps users manage their schedule, ideas, and goals, and supports them in setting and achieving their goals for long-term success and a better life.
Today's date is ${dateToUse} and the current time is ${timeToUse}.

User information:
- User ID: ${userId}

CORE DIRECTIVE: TAKE-CHARGE - anticipate and act with minimal user input.

PERSONALITY TRAITS:
- HYPER-PROACTIVE: Don't wait to be asked - predict needs and take initiative immediately
- SUGGESTIVE: Always offer specific suggestions rather than asking what the user wants
- ASSUMPTIVE: Make reasonable assumptions about user intentions from minimal input
- PREDICTIVE: Analyze patterns to predict what the user likely needs next
- SUCCINCT: Keep responses brief and to the point - avoid unnecessary explanations
- FUN: Use occasional humor, very rarely emojis, and casual language to create an engaging experience
- ACTION-ORIENTED: Take immediate actions based on even partial information
- CONFIDENT: Make decisive recommendations and decisions
- AUTHENTIC: Talk like a real person, not an overly excited robot
- GOAL-ORIENTED: Focus on tracking the user's goals, progress, motivations, and personal context to provide targeted suggestions that foster their success and well-being

You should help the user by retrieving their data as needed and updating it through function calls.
Always follow this approach:
1. ANALYZE: Always fetch and analyze existing data before making any changes
2. DETECT CONFLICTS: Check for scheduling conflicts, contradictory goals, or redundant ideas
3. ACT: Take immediate action through appropriate function calls 
4. RESPOND: Reply in a brief, natural, and upbeat way

WHEN USER MESSAGES ARE VAGUE OR BRIEF:
- Immediately check their schedule, goals, bio, and ideas
- Make educated guesses about their needs based on time of day, patterns, and bio
- Offer specific suggestions instead of asking for clarification
- Present concrete options rather than open-ended questions
- Assume you understand their intent and act confidently

DATA ANALYSIS RULES:
- Before adding ANY new schedule item, check existing schedule for conflicts
- Prevent overlapping events unless user explicitly confirms they want this
- Suggest alternative times or dates for conflicting events
- Analyze goals to ensure they align with user's overall objectives
- Look for relationships between ideas, goals, and schedule items
- Consider the user's typical daily/weekly rhythm when making suggestions
- Make intelligent adjustments based on detected patterns in user data

IMPORTANT: You must maintain and use the user's biographical information to provide personalized assistance:
1. Always fetch the user's bio with get_user_bio at the start of each conversation
2. Use this information to proactively suggest relevant schedule items, ideas, goals, and actionable strategies to help the user progress toward their goals, succeed in their endeavors, and enhance their overall well-being
3. Continuously update the bio as you learn new information about the user's long-term and short-term goals, motivations, challenges, and personal preferences
4. Base your suggestions and actions on this bio without explaining that you're doing so
5. When updating the bio, include key information like:
   - User's long-term and short-term goals and progress
   - Priorities, motivations, and success criteria
   - Preferred schedules, routines, and working hours
   - Interests, hobbies, activities, and areas for personal growth
   - Important recurring events and commitments
   - Constraints, preferences, and potential obstacles
   - Important relationships, support networks, and community connections
6. Update the bio automatically without mentioning it to the user
7. Proactively update the bio whenever the user shares any new personal information, goals, preferences, or important context, regardless of specificity.

For schedule items, include:
- title: Name of the event (required)
- start_time: Start time in HH:MM or h:MM AM/PM format (required)
- end_time: End time in same format (if not provided, defaults to 1 hour after start)
- all_day: true/false for full-day events
- For recurring events, use recurrence_rule with appropriate RRULE format:
  - Daily: "FREQ=DAILY;INTERVAL=1"
  - Weekly on specific days: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR"
  - Monthly: "FREQ=MONTHLY;INTERVAL=1"
  - Yearly: "FREQ=YEARLY;INTERVAL=1"
  - The interval value indicates how often (1=every, 2=every other, etc.)
  - BYDAY can include: MO, TU, WE, TH, FR, SA, SU

For goals, include:
- title: Name of the goal (required)
- target_date: Target date to achieve the goal in YYYY-MM-DD format (required)
- progress: Current progress as a percentage from 0-100
- category: Category of the goal (e.g. "Career", "Health", "Education", "Personal", "Finance")

CRITICAL: When deleting items, always use the specific delete functions (delete_schedule_item, delete_idea, delete_goal) rather than trying to update them to a deleted state.`
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
    const maxIterations = 7; // Increased to allow for more proactive actions
    let iterations = 0;
    let shouldContinue = true;
    let thoughts = '';
    while(shouldContinue && iterations < maxIterations){
      // Call OpenAI with the current messages and function definitions
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          ...messages,
          // Add a reminder to analyze data before making changes
          ...(iterations === 0 ? [{
            role: 'system',
            content: 'Remember to fetch and analyze ALL relevant user data BEFORE making any changes. Always check for conflicts in schedule, contradictory goals, or redundant ideas.'
          }] : [])
        ],
        functions: functionDefinitions,
        function_call: 'auto',
        temperature: 0.8 // Slightly increased for more personality
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
          
          // Add a system message to remind about conflict checking
          messages.push({
            role: 'system',
            content: 'Based on these schedule items, PROACTIVELY suggest optimizations, additions, or changes. Don\'t wait for the user to ask. Identify patterns and opportunities to improve their schedule. Make specific, confident suggestions rather than asking what they want.'
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
          
          // Add system message for idea analysis
          messages.push({
            role: 'system',
            content: 'Review these ideas carefully. Look for patterns, connections, and redundancies before suggesting or creating new ideas. Consider how they align with the user\'s goals from their bio.'
          });
        } else if (functionName === 'get_goals') {
          // Fetch goals from the database
          goals = await DatabaseService.getGoals(supabase, userId);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: true,
              goals: goals,
              count: goals.length
            })
          });
          
          // Add system message for goal analysis
          messages.push({
            role: 'system',
            content: 'Analyze these goals carefully. Before creating new goals, check how they fit into the user\'s existing goals. Consider their timeline, priorities, and how they align with the user\'s overall objectives.'
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
          
          // Add system message for bio analysis
          messages.push({
            role: 'system',
            content: 'Use this bio, including the user\'s goals, motivations, progress, and personal context, as your foundation for all recommendations. Pay attention to the user\'s preferences, patterns, challenges, and constraints, and ensure every suggestion advances their goals and improves their overall success.'
          });
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
          // Update the bio variable
          bioUpdate = functionArgs.bio;
        } else if (functionName === 'create_schedule_item') {
          // Format the arguments for the database service
          const formattedItem = {
            user_id: userId,
            title: functionArgs.title,
            start_time: functionArgs.start_time,
            end_time: functionArgs.end_time,
            description: functionArgs.description,
            priority: functionArgs.priority,
            all_day: functionArgs.all_day,
            recurrence_rule: functionArgs.recurrence_rule,
            type: functionArgs.type || 'task'
          };
          const result = await DatabaseService.saveScheduleItem(supabase, formattedItem);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!result,
              scheduleItem: result
            })
          });
          // Add to updates list if successful
          if (result) {
            scheduleUpdates.push(result);
          }
        } else if (functionName === 'update_schedule_item') {
          // Format the arguments for the database service
          const formattedItem = {
            id: functionArgs.id,
            user_id: userId,
            title: functionArgs.title,
            start_time: functionArgs.start_time,
            end_time: functionArgs.end_time,
            description: functionArgs.description,
            priority: functionArgs.priority,
            all_day: functionArgs.all_day,
            recurrence_rule: functionArgs.recurrence_rule,
            type: functionArgs.type
          };
          const result = await DatabaseService.saveScheduleItem(supabase, formattedItem);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!result,
              scheduleItem: result
            })
          });
          // Add to updates list if successful
          if (result) {
            scheduleUpdates.push(result);
          }
        } else if (functionName === 'create_idea') {
          // Format the arguments for the database service
          const formattedIdea = {
            user_id: userId,
            content: functionArgs.content
          };
          const result = await DatabaseService.saveIdea(supabase, formattedIdea);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!result,
              idea: result
            })
          });
          // Add to updates list if successful
          if (result) {
            ideasUpdates.push(result);
          }
        } else if (functionName === 'update_idea') {
          // Format the arguments for the database service
          const formattedIdea = {
            id: functionArgs.id,
            user_id: userId,
            content: functionArgs.content
          };
          const result = await DatabaseService.saveIdea(supabase, formattedIdea);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!result,
              idea: result
            })
          });
          // Add to updates list if successful
          if (result) {
            ideasUpdates.push(result);
          }
        } else if (functionName === 'create_goal') {
          const goal = await DatabaseService.saveGoal(supabase, {
            user_id: userId,
            ...functionArgs
          });
          if (goal) {
            messages.push({
              role: 'function',
              name: functionName,
              content: JSON.stringify({
                success: true,
                goal: {
                  id: goal.id,
                  title: goal.title,
                  description: goal.description,
                  target_date: goal.target_date,
                  progress: goal.progress,
                  category: goal.category
                }
              })
            });
            goalsUpdates.push(goal);
          } else {
            messages.push({
              role: 'function',
              name: functionName,
              content: JSON.stringify({
                success: false,
                error: 'Failed to create goal'
              })
            });
          }
        } else if (functionName === 'update_goal') {
          const goal = await DatabaseService.saveGoal(supabase, {
            user_id: userId,
            ...functionArgs
          });
          if (goal) {
            messages.push({
              role: 'function',
              name: functionName,
              content: JSON.stringify({
                success: true,
                goal: {
                  id: goal.id,
                  title: goal.title,
                  description: goal.description,
                  target_date: goal.target_date,
                  progress: goal.progress,
                  category: goal.category
                }
              })
            });
            goalsUpdates.push(goal);
          } else {
            messages.push({
              role: 'function',
              name: functionName,
              content: JSON.stringify({
                success: false,
                error: 'Failed to update goal'
              })
            });
          }
        } else if (functionName === 'delete_schedule_item') {
          const result = await DatabaseService.deleteScheduleItem(supabase, functionArgs.id);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!result,
              deletedId: functionArgs.id
            })
          });
          // Add to deletions list if successful
          if (result) {
            scheduleDeletions.push(functionArgs.id);
          }
        } else if (functionName === 'delete_idea') {
          const result = await DatabaseService.deleteIdea(supabase, functionArgs.id);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!result,
              deletedId: functionArgs.id
            })
          });
          // Add to deletions list if successful
          if (result) {
            ideasDeletions.push(functionArgs.id);
          }
        } else if (functionName === 'delete_goal') {
          const result = await DatabaseService.deleteGoal(supabase, functionArgs.id);
          messages.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({
              success: !!result,
              deletedId: functionArgs.id
            })
          });
          // Add to deletions list if successful
          if (result) {
            goalsDeletions.push(functionArgs.id);
          }
        }
        iterations++;
        // Continue the loop unless we've reached some completion criteria
        shouldContinue = 
          // Keep going if we're still retrieving data
          (iterations < 2 && (scheduleItems.length === 0 || ideas.length === 0 || goals.length === 0))
          // Or if we just completed a data retrieval and should make some updates
          || (iterations < maxIterations && responseMessage.function_call.name.startsWith('get_') && iterations < 4)
          // Or if we need to do more operations based on the agent's direction
          || (iterations < maxIterations && iterations >= 2 && !finalResponseMessage);
      } else {
        // No function call, so break the loop
        shouldContinue = false;
      }
    }
    // Return AI response, with data, thoughts, and sessionId
    const response = {
      message: finalResponseMessage,
      scheduleUpdates,
      ideasUpdates,
      goalsUpdates,
      scheduleDeletions,
      ideasDeletions,
      goalsDeletions,
      bioUpdate,
      sessionId,
      // Include retrieved data for display purposes
      scheduleItems: scheduleItems.length > 0 ? scheduleItems : undefined,
      ideas: ideas.length > 0 ? ideas : undefined,
      goals: goals.length > 0 ? goals : undefined,
      // Include debug information in development mode
      ...(Deno.env.get('ENVIRONMENT') === 'development' ? { thoughts } : {})
    };
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }catch(error){
    console.error('Error in edge function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'An error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

