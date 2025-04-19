"use client";

import { useState, useRef, useEffect } from 'react';
import { SendIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getAiResponse } from '@/lib/ai-service';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface AiChatProps {
  className?: string;
}

export function AiChat({ className }: AiChatProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Scroll to bottom of chat when messages change
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setIsLoading(true);
    setWelcomeVisible(false);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    
    try {
      // Call GPT-4 API
      const response = await getAiResponse(userMessage);
      
      // Add AI response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      
      // Dispatch event with all the category updates
      window.dispatchEvent(new CustomEvent('ai-response', { 
        detail: { 
          query: userMessage,
          scheduleUpdates: response.scheduleUpdates,
          ideasUpdates: response.ideasUpdates,
          habitsUpdates: response.habitsUpdates
        } 
      }));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
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

  return (
    <Card className={cn(
      "w-full border border-border/40 bg-background/60 backdrop-blur-sm shadow-lg transition-all duration-300 hover:shadow-xl",
      className
    )}>
      <CardContent className="p-6">
        {welcomeVisible && messages.length === 0 ? (
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
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={cn(
                  "mb-4 p-3 rounded-lg",
                  msg.role === 'user' 
                    ? "bg-primary/10 ml-8" 
                    : "bg-secondary/10 mr-8"
                )}
              >
                <p className="text-sm font-semibold mb-1">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </p>
                <p className="text-base whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            <div ref={chatEndRef} />
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