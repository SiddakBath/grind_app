'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSupabase } from '@/app/supabase-provider';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, SendIcon, RefreshCwIcon, Code2, ArrowRight, MessageSquare, Wrench, Bot, Brain, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { EVENTS } from '@/app/supabase-provider';
import { SearchIcon } from 'lucide-react';

interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'function';
  content: string;
  timestamp: Date;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string>(generateSessionId());

  // Suggested prompts for empty state
  const suggestedPrompts = [
    "Optimize today's schedule",
    "Create a deep work block for my startup",
    "What's blocking my progress right now?",
    "What's my next milestone to hit?",
  ];

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
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
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
      
      if (data.message) {
        messageContent = data.message;
      }
      
      // Check if the response contains messages with function calls
      if (data.thoughts) {
        // Parse the thoughts string to extract any function calls
        const thoughtsStr = data.thoughts;
        
        // No need to extract function calls from thoughts as we're already
        // getting them through the updates that are returned
        console.log('Agent thoughts:', thoughtsStr);
      }
      
      // Add agent message to chat
      const agentMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: messageContent,
        timestamp: new Date(),
      };
      
      const newMessages: Message[] = [agentMessage];
      
      // Include GET function responses in the messages
      if (data.scheduleItems) {
        const scheduleMessage: Message = {
          id: generateId(),
          role: 'function',
          name: 'get_schedule_items',
          content: JSON.stringify({ 
            success: true, 
            scheduleItems: data.scheduleItems,
            count: data.scheduleItems.length || 0
          }),
          timestamp: new Date()
        };
        newMessages.push(scheduleMessage);
      }
      
      if (data.ideas) {
        const ideasMessage: Message = {
          id: generateId(),
          role: 'function',
          name: 'get_ideas',
          content: JSON.stringify({ 
            success: true, 
            ideas: data.ideas,
            count: data.ideas.length || 0
          }),
          timestamp: new Date()
        };
        newMessages.push(ideasMessage);
      }
      
      if (data.goals) {
        const goalsMessage: Message = {
          id: generateId(),
          role: 'function',
          name: 'get_goals',
          content: JSON.stringify({ 
            success: true, 
            goals: data.goals,
            count: data.goals.length || 0
          }),
          timestamp: new Date()
        };
        newMessages.push(goalsMessage);
      }
      
      // If we have any function responses, add them to the messages
      if (data.scheduleUpdates?.length > 0 || 
          data.ideasUpdates?.length > 0 || 
          data.goalsUpdates?.length > 0 ||
          data.scheduleDeletions?.length > 0 ||
          data.ideasDeletions?.length > 0 ||
          data.goalsDeletions?.length > 0) {
        
        // For each type of update, create a function response message
        if (data.scheduleUpdates?.length > 0) {
          const scheduleMessage: Message = {
            id: generateId(),
            role: 'function',
            name: (data.scheduleUpdates[0].id ? 'update_schedule_item' : 'create_schedule_item'),
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
            name: (data.ideasUpdates[0].id ? 'update_idea' : 'create_idea'),
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
        
        if (data.goalsUpdates?.length > 0) {
          const goalsMessage: Message = {
            id: generateId(),
            role: 'function',
            name: (data.goalsUpdates[0].id ? 'update_goal' : 'create_goal'),
            content: JSON.stringify({ 
              success: true, 
              goals: data.goalsUpdates,
              count: data.goalsUpdates.length
            }),
            timestamp: new Date()
          };
          newMessages.push(goalsMessage);
          
          // Dispatch real-time update event
          window.dispatchEvent(new CustomEvent(EVENTS.GOALS_UPDATED));
        }
        
        // Handle deletions
        if (data.scheduleDeletions?.length > 0) {
          const scheduleDeletionMessage: Message = {
            id: generateId(),
            role: 'function',
            name: 'delete_schedule_item',
            content: JSON.stringify({ 
              success: true, 
              deletedIds: data.scheduleDeletions,
              count: data.scheduleDeletions.length
            }),
            timestamp: new Date()
          };
          newMessages.push(scheduleDeletionMessage);
          
          // Dispatch real-time update event
          window.dispatchEvent(new CustomEvent(EVENTS.SCHEDULE_UPDATED));
        }
        
        if (data.ideasDeletions?.length > 0) {
          const ideasDeletionMessage: Message = {
            id: generateId(),
            role: 'function',
            name: 'delete_idea',
            content: JSON.stringify({ 
              success: true, 
              deletedIds: data.ideasDeletions,
              count: data.ideasDeletions.length
            }),
            timestamp: new Date()
          };
          newMessages.push(ideasDeletionMessage);
          
          // Dispatch real-time update event
          window.dispatchEvent(new CustomEvent(EVENTS.IDEAS_UPDATED));
        }
        
        if (data.goalsDeletions?.length > 0) {
          const goalsDeletionMessage: Message = {
            id: generateId(),
            role: 'function',
            name: 'delete_goal',
            content: JSON.stringify({ 
              success: true, 
              deletedIds: data.goalsDeletions,
              count: data.goalsDeletions.length
            }),
            timestamp: new Date()
          };
          newMessages.push(goalsDeletionMessage);
          
          // Dispatch real-time update event
          window.dispatchEvent(new CustomEvent(EVENTS.GOALS_UPDATED));
        }
        
        toast({
          title: "Updates Applied",
          description: "Your data has been updated based on your conversation."
        });
      }
      
      // Add to the handleSubmit function where other updates are processed
      if (data.resourcesUpdates?.length > 0) {
        const resourcesMessage: Message = {
          id: generateId(),
          role: 'function',
          name: (data.resourcesUpdates[0].id ? 'update_resource' : 'create_resource'),
          content: JSON.stringify({ 
            success: true, 
            resources: data.resourcesUpdates,
            count: data.resourcesUpdates.length
          }),
          timestamp: new Date()
        };
        newMessages.push(resourcesMessage);
        
        // Dispatch real-time update event
        window.dispatchEvent(new CustomEvent(EVENTS.RESOURCES_UPDATED));
      }
      
      if (data.resourcesDeletions?.length > 0) {
        const resourcesDeletionMessage: Message = {
          id: generateId(),
          role: 'function',
          name: 'delete_resource',
          content: JSON.stringify({ 
            success: true, 
            deletedIds: data.resourcesDeletions,
            count: data.resourcesDeletions.length
          }),
          timestamp: new Date()
        };
        newMessages.push(resourcesDeletionMessage);
        
        // Dispatch real-time update event
        window.dispatchEvent(new CustomEvent(EVENTS.RESOURCES_UPDATED));
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
          // Format arrays and objects more readably
          if (Array.isArray(value)) {
            if (value.length === 0) return `${key}: []`;
            if (value.length > 3) return `${key}: [${value.length} items]`;
            return `${key}: [${value.map(v => typeof v === 'object' ? '...' : v).join(', ')}]`;
          }
          return `${key}: {...}`;
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
          
          // If it's an ISO date string, parse it
          try {
            const date = new Date(timeStr);
            if (!isNaN(date.getTime())) {
              // Format as 12-hour time with proper timezone handling
              return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'UTC' // Use UTC to avoid timezone conversion issues
              });
            }
          } catch (e) {
            console.error('Error parsing date:', e);
          }
          
          // If it's a simple time string like "3:00 PM" or "15:00", return as is
          if (timeStr.includes(':') || /^\d+$/.test(timeStr)) {
            return timeStr;
          }
          
          // Return the original string if parsing failed
          return timeStr;
        };

        console.log(data.scheduleItems);
        
        return (
          <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="font-medium text-sm">{data.count} schedule item{data.count !== 1 ? 's' : ''}</div>
            {data.scheduleItems.length > 0 ? (
              <div className="space-y-1">
                {data.scheduleItems.map((item: any, i: number) => (
                  <div key={i} className="bg-black/5 p-1.5 rounded-sm text-xs mt-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatTime(item.start_time)}-{formatTime(item.end_time)}
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
            <div className="font-medium text-sm">{data.count} idea{data.count !== 1 ? 's' : ''}</div>
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
      
      // Handle goals
      if (functionName?.includes('goal') && data.goals) {
        // Helper to format date more readably
        const formatDate = (dateStr: string) => {
          if (!dateStr) return '';
          
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            }
          } catch (e) {
            console.error('Error parsing date:', e);
          }
          
          return dateStr;
        };
        
        return (
          <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="font-medium text-sm">{data.count} goal{data.count !== 1 ? 's' : ''}</div>
            {data.goals?.length > 0 ? (
              <div className="space-y-1">
                {data.goals.map((goal: any, i: number) => (
                  <div key={i} className="bg-black/5 p-1.5 rounded-sm text-xs mt-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{goal.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {goal.category && `${goal.category} • `}
                        {formatDate(goal.target_date)}
                      </span>
                    </div>
                    {goal.description && <div className="text-xs italic mt-0.5">{goal.description}</div>}
                    {typeof goal.progress === 'number' && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div 
                            className="bg-blue-500 dark:bg-blue-400 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(Math.max(goal.progress, 0), 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No goals found</div>
            )}
          </div>
        );
      }
      
      // Handle deletion responses
      if (functionName?.includes('delete') && data.deletedIds) {
        const itemType = functionName.includes('schedule') 
          ? 'Schedule item' 
          : functionName.includes('idea') 
            ? 'Idea' 
            : 'Goal';
            
        return (
          <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="font-medium text-sm text-red-600 dark:text-red-400">
              Deleted {data.count} {itemType.toLowerCase()}{data.count !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.deletedNames && data.deletedNames.length > 0 
                ? data.deletedNames.map((name: string, i: number) => (
                    <div key={i} className="mt-1">• {name}</div>
                  ))
                : `${data.count} item${data.count !== 1 ? 's' : ''} removed`
              }
            </div>
          </div>
        );
      }
      
      // Handle single item operations
      if (data.item || data.idea || data.goal) {
        const item = data.item || data.idea || data.goal;
        const itemType = data.item ? 'Schedule item' : data.idea ? 'Idea' : 'Goal';
        
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
      
      // Handle resources
      if (functionName?.includes('resource') && data.resources) {
        return (
          <div className="space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="font-medium text-sm">{data.count} resource{data.count !== 1 ? 's' : ''}</div>
            {data.resources?.length > 0 ? (
              <div className="space-y-1">
                {data.resources.map((resource: any, i: number) => (
                  <div key={i} className="bg-black/5 p-1.5 rounded-sm text-xs mt-1">
                    <div className="text-sm font-medium">{resource.title}</div>
                    <div className="text-xs text-muted-foreground">{resource.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {resource.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Relevance: {resource.relevance_score}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No resources found</div>
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

  // Parse function response for display
  const parseFunctionResponseForDisplay = (content: string) => {
    try {
      const data = JSON.parse(content);
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return content;
    }
  };

  // Format function name to be more natural
  const formatFunctionName = (name: string): string => {
    // Replace underscores with spaces
    const withSpaces = name.replace(/_/g, ' ');
    
    // Handle common function prefixes
    if (withSpaces.startsWith('create ')) {
      return `Added ${withSpaces.substring(7)}`;
    } else if (withSpaces.startsWith('update ')) {
      return `Updated ${withSpaces.substring(7)}`;
    } else if (withSpaces.startsWith('delete ')) {
      return `Removed ${withSpaces.substring(7)}`;
    } else if (withSpaces.startsWith('get ')) {
      return `Retrieved ${withSpaces.substring(4)}`;
    }
    
    // Capitalize first letter of each word
    return withSpaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format message content to handle bold text with ** **
  const formatMessageContent = (content: string): React.ReactNode => {
    if (!content.includes('**')) {
      return content;
    }

    const parts = content.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove the asterisks and wrap in a strong tag
        const boldText = part.slice(2, -2);
        return <strong key={index}>{boldText}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="w-full">
      <div className="p-[2px] rounded-xl bg-gradient-to-r from-blue-500/60 via-violet-500/60 to-emerald-500/60 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
        <Card className={cn(
          "w-full bg-background backdrop-blur-sm transition-all duration-300 rounded-xl overflow-hidden",
          className
        )}>
          <CardContent className="p-0">
            {/* Header */}
            <div className="p-4 flex justify-between items-center border-b border-border/30">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-500" />
                Agent
              </h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={resetConversation}
                title="Clear chat"
                disabled={isLoading || messages.length === 0}
              >
                <RefreshCwIcon className="h-4 w-4" />
              </Button>
            </div>
          
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="py-8 flex flex-col items-center justify-center text-center px-4">
                <div className="relative mb-4">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/40 via-violet-500/40 to-emerald-500/40 blur-xl" />
                  <div className="p-[2px] rounded-full bg-gradient-to-r from-blue-500/60 via-violet-500/60 to-emerald-500/60">
                    <div className="relative rounded-full bg-background p-3">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-semibold">How can I help you today?</h3>
                <p className="text-muted-foreground text-sm max-w-md mt-2">
                  Ask me about scheduling, tasks, ideas, or habits. I can help you manage your time and productivity.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-2xl">
                  {suggestedPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      className="h-auto py-3 px-4 text-sm justify-start truncate overflow-hidden"
                      onClick={() => {
                        setInput(prompt);
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }}
                    >
                      <SearchIcon className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                      <span className="truncate">{prompt}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Messages */}
            {messages.length > 0 && (
              <div ref={containerRef} className="h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 px-4 py-6 bg-gradient-to-b from-background/60 to-background space-y-6">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex",
                      msg.role === 'user' ? "justify-end" : "justify-start",
                      "animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
                        msg.role === 'user' 
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tr-none" 
                          : msg.role === 'function'
                            ? "bg-blue-50 dark:bg-blue-900/30 text-foreground rounded-tl-none border border-blue-200 dark:border-blue-800"
                            : "bg-secondary text-secondary-foreground rounded-tl-none"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn(
                          "text-sm font-medium",
                          msg.role === 'user' 
                            ? "text-gray-700 dark:text-gray-300" 
                            : msg.role === 'function'
                              ? "text-blue-800 dark:text-blue-300"
                              : "text-secondary-foreground"
                        )}>
                          {msg.role === 'user' 
                            ? 'You' 
                            : msg.role === 'function' 
                            ? <span className="flex items-center">
                                <Wrench className="h-3.5 w-3.5 mr-1" />
                                {msg.name && formatFunctionName(msg.name)}
                              </span> 
                            : 'Assistant'
                          }
                        </p>
                        <p className="text-xs opacity-70">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      
                      {/* Message content */}
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {msg.role === 'function' ? (
                          <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded overflow-x-auto">
                            {formatFunctionResponse(msg.content, msg.name)}
                          </div>
                        ) : (
                          <div className="text-sm whitespace-pre-wrap">
                            {formatMessageContent(msg.content)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          
            {/* Input area */}
            <div className="p-4 border-t border-border/30 bg-background/80">
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message here..."
                  className={cn(
                    "w-full min-h-[80px] p-4 pr-14 rounded-xl border border-input",
                    "bg-background/50 backdrop-blur-sm resize-none",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                    "placeholder:text-muted-foreground transition-all duration-200",
                    "text-base leading-relaxed shadow-sm"
                  )}
                  disabled={isLoading}
                />
                <Button 
                  type="submit"
                  size="icon"
                  className={cn(
                    "absolute bottom-4 right-4 rounded-full transition-all duration-300",
                    "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700",
                    "text-white shadow-md hover:shadow-lg"
                  )}
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <SendIcon className="h-5 w-5" />
                  )}
                </Button>
              </form>
              {isLoading && (
                <div className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing your message...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}