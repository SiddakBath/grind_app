"use client";

import { useState, useEffect, useCallback } from 'react';
import { Activity, ExternalLink, Calendar, CheckCircle, Zap, BarChart, Maximize2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DatabaseService } from '@/lib/database-service';
import { useToast } from '@/hooks/use-toast';
import { EVENTS } from '@/app/supabase-provider';

interface Habit {
  id: string;
  title: string;
  frequency: string;
  type: 'daily' | 'weekly' | 'monthly';
}

interface HabitsPanelProps {
  activeQuery: string;
  updates?: any[];
  isExpanded?: boolean;
  onExpandToggle?: (isExpanded: boolean) => void;
}

export function HabitsPanel({ activeQuery, updates = [], isExpanded = false, onExpandToggle }: HabitsPanelProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const { toast } = useToast();
  
  // Function to load habits from database
  const loadHabits = useCallback(async () => {
    try {
      setIsLoadingDB(true);
      // Fetch habits from database
      const items: any[] = await DatabaseService.getHabits();
      
      // Map database fields directly to habit format
      const formattedHabits: Habit[] = items.map((item: any) => {
        // Determine title and frequency
        const title = item.title || item.description || "Untitled Habit";
        const frequency = item.frequency || "Daily";
        // Validate type
        const typeVal = ['daily', 'weekly', 'monthly'].includes(item.type)
          ? (item.type as 'daily' | 'weekly' | 'monthly')
          : 'daily';
        return {
          id: String(item.id),
          title,
          frequency,
          type: typeVal,
        };
      });
      
      setHabits(formattedHabits);
    } catch (error) {
      console.error('Error loading habits:', error);
      toast({
        title: "Error",
        description: "Failed to refresh habits",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDB(false);
    }
  }, [toast]);
  
  // Load initial data from database
  useEffect(() => {
    loadHabits();
  }, [loadHabits]);
  
  // Handle real-time updates
  const handleRealtimeUpdate = useCallback(() => {
    console.log('Habits updated, refreshing data...');
    loadHabits().catch(err => {
      console.error('Error refreshing habits data:', err);
    });
  }, [loadHabits]);
  
  // Listen for real-time updates
  useEffect(() => {
    // Add event listener for real-time updates
    window.addEventListener(EVENTS.HABITS_UPDATED, handleRealtimeUpdate);
    
    // Clean up event listener
    return () => {
      window.removeEventListener(EVENTS.HABITS_UPDATED, handleRealtimeUpdate);
    };
  }, [handleRealtimeUpdate]);
  
  // Process updates from GPT-4
  useEffect(() => {
    if (!updates?.length) return;
    
    setIsUpdating(true);
    
    // Process updates from GPT-4 and save to database
    const processUpdates = async () => {
      try {
        // Save to database
        await DatabaseService.saveHabits(updates);
        
        // Update UI with new items
        const newHabits = updates.map(update => {
          let type: 'daily' | 'weekly' | 'monthly' = 'daily';
          
          if (update.frequency?.toLowerCase()?.includes('week') || 
              update.type?.toLowerCase()?.includes('week')) {
            type = 'weekly';
          } else if (update.frequency?.toLowerCase()?.includes('month') || 
                     update.type?.toLowerCase()?.includes('month')) {
            type = 'monthly';
          }
          
          return {
            id: Date.now() + Math.random().toString(),
            title: update.title || update.habit || update.description || "New Habit",
            frequency: update.frequency || "Daily",
            type
          };
        });
        
        setHabits(prev => [...prev, ...newHabits]);
        
        toast({
          title: "Success",
          description: `Added ${updates.length} new habit(s)`,
        });
      } catch (error) {
        console.error('Error saving habits:', error);
        
        toast({
          title: "Error",
          description: "Failed to save habits to database",
          variant: "destructive",
        });
      } finally {
        setIsUpdating(false);
      }
    };
    
    processUpdates();
  }, [updates, toast]);
  
  // Legacy behavior for backwards compatibility
  useEffect(() => {
    if (!activeQuery || updates?.length) return;
    
    // Simulate updating habits based on AI response
    if (activeQuery.toLowerCase().includes('habit') || 
        activeQuery.toLowerCase().includes('routine') || 
        activeQuery.toLowerCase().includes('track') ||
        activeQuery.toLowerCase().includes('consistency')) {
      setIsUpdating(true);
      
      // Simulate delay for AI processing
      setTimeout(() => {
        // Generate a new habit based on the query
        if (activeQuery.toLowerCase().includes('exercise')) {
          setHabits(prev => [
            ...prev, 
            { 
              id: Date.now().toString(), 
              title: '30-Minute Exercise', 
              frequency: 'Mon, Wed, Fri', 
              type: 'weekly'
            }
          ]);
        } else if (activeQuery.toLowerCase().includes('reading')) {
          setHabits(prev => [
            ...prev, 
            { 
              id: Date.now().toString(), 
              title: 'Reading Session', 
              frequency: 'Evenings', 
              type: 'daily'
            }
          ]);
        } else if (activeQuery.toLowerCase().includes('water') || activeQuery.toLowerCase().includes('hydration')) {
          setHabits(prev => [
            ...prev, 
            { 
              id: Date.now().toString(), 
              title: 'Drink 8 Glasses of Water', 
              frequency: 'Daily', 
              type: 'daily'
            }
          ]);
        }
        
        setIsUpdating(false);
      }, 1500);
    }
  }, [activeQuery, updates]);

  const getIcon = (type: Habit['type']) => {
    switch (type) {
      case 'daily':
        return <CheckCircle className="h-4 w-4" />;
      case 'weekly':
        return <Calendar className="h-4 w-4" />;
      case 'monthly':
        return <Activity className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const toggleExpandedView = () => {
    if (onExpandToggle) {
      onExpandToggle(!isExpanded);
    }
  };

  return (
    <Card className={cn(
      "border border-border/40 bg-background/60 backdrop-blur-sm transition-all duration-300",
      "hover:shadow-md flex flex-col",
      isUpdating && "animate-pulse",
      isExpanded && "fixed inset-10 z-50"
    )}
    style={{ 
      height: isExpanded ? 'calc(100vh - 5rem)' : '100%' 
    }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <span>Habits</span>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={toggleExpandedView} className="ml-auto">
          <Maximize2 className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className={cn(
        "flex-1 overflow-y-auto pb-6",
        isExpanded && "px-6"
      )}>
        {habits.length > 0 ? (
          <div className="space-y-4">
            {habits.map((habit) => (
              <div 
                key={habit.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border border-border/50",
                  "hover:bg-muted/50 hover:border-border transition-all",
                  "text-foreground cursor-pointer",
                  habit.id === habits[habits.length - 1]?.id && activeQuery && "animate-in fade-in-50 slide-in-from-bottom-3"
                )}
              >
                <div className="flex items-center gap-2">
                  {getIcon(habit.type)}
                  <span className="text-sm">{habit.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">{habit.frequency}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-medium mb-2">Build better habits</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Tell the AI about habits you&apos;d like to track and develop.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 