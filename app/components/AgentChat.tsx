'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSupabase } from '@/app/supabase-provider';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, SendIcon, RefreshCwIcon, Code2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { EVENTS } from '@/app/supabase-provider';

interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'function';
  content: string;
  timestamp: Date;
  function_call?: FunctionCall;
  name?: string; // For function response messages
}

interface AgentChatProps {
  className?: string;
}

export default function AgentChat({ className }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { supabase, session } = useSupabase();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string>(generateSessionId());

  // Generate a unique session ID
  function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Reset the conversation
  const resetConversation = () => {
    setMessages([]);
    sessionIdRef.current = generateSessionId();
    
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    toast({
      title: "Conversation Reset",
      description: "Started a fresh conversation with your assistant."
    });
  };

  // Focus input on initial render
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate a unique ID for each message
  const generateId = () => Math.random().toString(36).substring(2, 15);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !session) return;
    
    // Add user message to chat
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Get authenticated user and token
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Not authenticated');
      }
      
      // Get session for the token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token;
      
      if (!token) {
        throw new Error('No valid session token');
      }
      
      // Prepare chat history in proper format for the agent
      // Include any function messages in the chat history
      const chatHistory = messages.map(msg => {
        if (msg.role === 'function') {
          return {
            role: 'function',
            name: msg.name,
            content: msg.content
          };
        } else if (msg.function_call) {
          return {
            role: msg.role,
            content: msg.content,
            function_call: {
              name: msg.function_call.name,
              arguments: JSON.stringify(msg.function_call.arguments)
            }
          };
        } else {
          return {
            role: msg.role,
            content: msg.content
          };
        }
      });
      
      // Call the agent edge function
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/app-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: input,
          userId: user.id,
          chatHistory,
          sessionId: sessionIdRef.current
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get agent response');
      }
      
      const data = await response.json();
      
      // Log the response data to help debug
      console.log('Agent response data:', data);
      
      // Extract message from response
      let messageContent = "I've processed your request.";
      let functionCall: FunctionCall | undefined;
      
      if (data.message) {
        messageContent = data.message;
      }
      
      // Check if the response contains messages with function calls
      if (data.thoughts) {
        // Parse the thoughts string to extract any function calls
        const thoughtsStr = data.thoughts;
        const functionCallMatch = thoughtsStr.match(/function_call":\s*{([^}]+)}/);
        
        if (functionCallMatch) {
          try {
            // Try to parse the function call from the thoughts
            const functionCallString = `{${functionCallMatch[1]}}`;
            const parsedCall = JSON.parse(functionCallString.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":'));
            
            if (parsedCall.name) {
              functionCall = {
                name: parsedCall.name,
                arguments: typeof parsedCall.arguments === 'string' 
                  ? JSON.parse(parsedCall.arguments) 
                  : parsedCall.arguments
              };
            }
          } catch (e) {
            console.error('Error parsing function call from thoughts:', e);
          }
        }
      }
      
      // Add agent message to chat
      const agentMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: messageContent,
        timestamp: new Date(),
        function_call: functionCall
      };
      
      const newMessages: Message[] = [agentMessage];
      
      // If we have any function responses, add them to the messages
      if (data.scheduleUpdates?.length > 0 || 
          data.ideasUpdates?.length > 0 || 
          data.habitsUpdates?.length > 0) {
        
        // For each type of update, create a function response message
        if (data.scheduleUpdates?.length > 0) {
          const scheduleMessage: Message = {
            id: generateId(),
            role: 'function',
            name: functionCall?.name?.includes('schedule') 
              ? functionCall.name 
              : 'get_schedule_items',
            content: JSON.stringify({ 
              success: true, 
              scheduleItems: data.scheduleUpdates,
              count: data.scheduleUpdates.length
            }),
            timestamp: new Date()
          };
          newMessages.push(scheduleMessage);
          
          // Dispatch real-time update event
          window.dispatchEvent(new CustomEvent(EVENTS.SCHEDULE_UPDATED));
        }
        
        if (data.ideasUpdates?.length > 0) {
          const ideasMessage: Message = {
            id: generateId(),
            role: 'function',
            name: functionCall?.name?.includes('idea') 
              ? functionCall.name 
              : 'get_ideas',
            content: JSON.stringify({ 
              success: true, 
              ideas: data.ideasUpdates,
              count: data.ideasUpdates.length
            }),
            timestamp: new Date()
          };
          newMessages.push(ideasMessage);
          
          // Dispatch real-time update event
          window.dispatchEvent(new CustomEvent(EVENTS.IDEAS_UPDATED));
        }
        
        if (data.habitsUpdates?.length > 0) {
          const habitsMessage: Message = {
            id: generateId(),
            role: 'function',
            name: functionCall?.name?.includes('habit') 
              ? functionCall.name 
              : 'get_habits',
            content: JSON.stringify({ 
              success: true, 
              habits: data.habitsUpdates,
              count: data.habitsUpdates.length
            }),
            timestamp: new Date()
          };
          newMessages.push(habitsMessage);
          
          // Dispatch real-time update event
          window.dispatchEvent(new CustomEvent(EVENTS.HABITS_UPDATED));
        }
        
        toast({
          title: "Updates Applied",
          description: "Your data has been updated based on your conversation."
        });
      }
      
      setMessages(prev => [...prev, ...newMessages]);
      
    } catch (error) {
      console.error('Error getting agent response:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Format function arguments for display
  const formatArguments = (args: Record<string, any>) => {
    // Return a nicely formatted version of the arguments
    return Object.entries(args)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join(', ');
  };

  // Format function response for display
  const formatFunctionResponse = (content: string, functionName?: string): React.ReactNode => {
    try {
      const data = JSON.parse(content);
      
      // Handle schedule items
      if (functionName?.includes('schedule') && data.scheduleItems) {
        // Helper to format time more readably
        const formatTime = (timeStr: string) => {
          if (!timeStr) return '';
          // Return without AM/PM for brevity if it exists
          return timeStr.replace(/\s+[AP]M/i, '');
        };
        
        return (
          <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="font-medium text-sm">Retrieved {data.count} schedule item{data.count !== 1 ? 's' : ''}</div>
            {data.scheduleItems.length > 0 ? (
              <div className="space-y-1">
                {data.scheduleItems.map((item: any, i: number) => (
                  <div key={i} className="bg-black/5 p-1.5 rounded-sm text-xs mt-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {item.date} • {formatTime(item.start_time)}-{formatTime(item.end_time)}
                      </span>
                    </div>
                    {item.recurring && (
                      <div className="text-blue-500 dark:text-blue-400 text-xs mt-0.5">
                        Recurring: {item.repeat_days ? item.repeat_days.join(', ') : 'Daily'}
                      </div>
                    )}
                    {item.description && <div className="text-xs italic mt-0.5">{item.description}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No scheduled items found</div>
            )}
          </div>
        );
      }
      
      // Handle ideas
      if (functionName?.includes('idea') && data.ideas) {
        return (
          <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="font-medium text-sm">Retrieved {data.count} idea{data.count !== 1 ? 's' : ''}</div>
            {data.ideas?.length > 0 ? (
              <div className="space-y-1">
                {data.ideas.map((idea: any, i: number) => (
                  <div key={i} className="bg-black/5 p-1.5 rounded-sm text-xs mt-1">
                    <div className="text-sm">{idea.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No ideas found</div>
            )}
          </div>
        );
      }
      
      // Handle habits
      if (functionName?.includes('habit') && data.habits) {
        return (
          <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="font-medium text-sm">Retrieved {data.count} habit{data.count !== 1 ? 's' : ''}</div>
            {data.habits?.length > 0 ? (
              <div className="space-y-1">
                {data.habits.map((habit: any, i: number) => (
                  <div key={i} className="bg-black/5 p-1.5 rounded-sm text-xs mt-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{habit.title}</span>
                      <span className="text-muted-foreground text-xs">{habit.frequency} {habit.streak > 0 && `• 🔥 ${habit.streak} day streak`}</span>
                    </div>
                    {habit.target_days && habit.target_days.length > 0 && (
                      <div className="text-xs mt-0.5">
                        Days: {habit.target_days.join(', ')}
                      </div>
                    )}
                    {habit.description && <div className="text-xs italic mt-0.5">{habit.description}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No habits found</div>
            )}
          </div>
        );
      }
      
      // Handle single item operations
      if (data.item || data.idea || data.habit) {
        const item = data.item || data.idea || data.habit;
        const itemType = data.item ? 'Schedule item' : data.idea ? 'Idea' : 'Habit';
        
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="text-sm text-green-600 dark:text-green-400">
              {data.success ? `✓ ${itemType} successfully ${item.id ? 'updated' : 'created'}` : `✗ Failed to ${item.id ? 'update' : 'create'} ${itemType.toLowerCase()}`}
            </div>
            {data.success && (
              <div className="text-xs text-muted-foreground">
                ID: {item.id}
              </div>
            )}
          </div>
        );
      }
      
      // For other function responses or fallback
      return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2">
          {data.success !== undefined && (
            <div className={`text-sm ${data.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {data.success ? '✓ Operation successful' : '✗ Operation failed'}
            </div>
          )}
          <div className="text-xs font-mono overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </div>
        </div>
      );
    } catch (e) {
      // If parsing fails, return the original content as text
      return <span>{content}</span>;
    }
  };

  return (
    <Card className={cn(
      "w-full border border-border/40 bg-background/60 backdrop-blur-sm shadow-lg transition-all duration-300 hover:shadow-xl",
      className
    )}>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
            {messages.length === 0 ? "New Conversation" : `Chat Session: ${sessionIdRef.current.split('_')[1]}`}
          </h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={resetConversation}
            title="Reset conversation"
            disabled={isLoading || messages.length === 0}
          >
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>
        
        {messages.length === 0 ? (
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400 pb-1">
              Hello, how can I assist you today?
            </h2>
            <p className="text-muted-foreground mt-2">
              Ask me about your schedule, ideas, or habits...
            </p>
          </div>
        ) : (
          <div className="mb-6 max-h-[400px] overflow-y-auto pr-2">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn(
                  "mb-4 p-3 rounded-lg",
                  msg.role === 'user' 
                    ? "bg-primary/10 ml-8" 
                    : "bg-secondary/10 mr-8"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold">
                      {msg.role === 'user' 
                        ? 'You' 
                        : msg.role === 'function' 
                        ? <span className="flex items-center">
                            <Code2 className="h-3 w-3 mr-1" />
                            {msg.name && msg.name.replace(/_/g, ' ')}
                          </span> 
                        : 'Assistant'
                      }
                    </p>
                    <p className="text-xs opacity-70">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                {msg.role === 'function' ? (
                  <div className="text-sm">
                    {formatFunctionResponse(msg.content, msg.name)}
                  </div>
                ) : (
                  <>
                    <p className="text-base whitespace-pre-wrap">{msg.content}</p>
                    
                    {msg.function_call && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <div className="flex items-center mb-1">
                          <Badge variant="outline" className="flex items-center gap-1 font-normal">
                            <Code2 className="h-3 w-3" />
                            Function Call
                          </Badge>
                        </div>
                        <div className="font-mono text-xs bg-black/5 p-2 rounded-md overflow-x-auto">
                          <span className="text-blue-600 dark:text-blue-400">{msg.function_call.name}</span>
                          ({formatArguments(msg.function_call.arguments)})
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            className={cn(
              "w-full min-h-[80px] p-4 pr-12 rounded-xl border border-input",
              "bg-background/50 backdrop-blur-sm resize-none",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-input",
              "placeholder:text-muted-foreground transition-all duration-200",
              "text-base leading-relaxed"
            )}
            disabled={isLoading}
          />
          <Button 
            type="submit"
            size="icon"
            className="absolute bottom-4 right-4 rounded-full"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SendIcon className="h-5 w-5" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 