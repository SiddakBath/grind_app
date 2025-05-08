"use client";

import { useState, useEffect, useCallback } from 'react';
import { Activity, ExternalLink, Calendar, CheckCircle, Zap, BarChart, Maximize2, Target, Pencil, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DatabaseService } from '@/lib/database-service';
import { useToast } from '@/hooks/use-toast';
import { EVENTS } from '@/app/supabase-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Goal {
  id: string;
  title: string;
  description?: string;
  target_date: string;
  progress?: number;
  category?: string;
}

interface GoalsPanelProps {
  activeQuery: string;
  updates?: any[];
  isExpanded?: boolean;
  onExpandToggle?: (isExpanded: boolean) => void;
}

export function GoalsPanel({ activeQuery, updates = [], isExpanded = false, onExpandToggle }: GoalsPanelProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const { toast } = useToast();
  
  // Function to load goals from database
  const loadGoals = useCallback(async () => {
    try {
      setIsLoadingDB(true);
      // Fetch goals from database
      const items: any[] = await DatabaseService.getGoals();
      
      // Map database fields directly to goal format
      const formattedGoals: Goal[] = items.map((item: any) => {
        return {
          id: String(item.id),
          title: item.title || "Untitled Goal",
          description: item.description,
          target_date: item.target_date || new Date().toISOString().split('T')[0],
          progress: item.progress || 0,
          category: item.category || "Personal"
        };
      });
      
      // Sort goals chronologically by target date
      formattedGoals.sort((a, b) => {
        return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
      });
      
      setGoals(formattedGoals);
    } catch (error) {
      console.error('Error loading goals:', error);
      toast({
        title: "Error",
        description: "Failed to refresh goals",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDB(false);
    }
  }, [toast]);
  
  // Load initial data from database
  useEffect(() => {
    loadGoals();
  }, [loadGoals]);
  
  // Handle real-time updates
  const handleRealtimeUpdate = useCallback(() => {
    console.log('Goals updated, refreshing data...');
    loadGoals().catch(err => {
      console.error('Error refreshing goals data:', err);
    });
  }, [loadGoals]);
  
  // Listen for real-time updates
  useEffect(() => {
    // Add event listener for real-time updates
    window.addEventListener(EVENTS.GOALS_UPDATED, handleRealtimeUpdate);
    
    // Clean up event listener
    return () => {
      window.removeEventListener(EVENTS.GOALS_UPDATED, handleRealtimeUpdate);
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
        await DatabaseService.saveGoals(updates);
        
        // Update UI with new items
        const newGoals = updates.map(update => {
          return {
            id: Date.now() + Math.random().toString(),
            title: update.title || update.goal || update.description || "New Goal",
            target_date: update.target_date || new Date().toISOString().split('T')[0],
            progress: update.progress || 0,
            category: update.category || "Personal"
          };
        });
        
        setGoals(prev => {
          // Combine previous and new goals
          const combined = [...prev, ...newGoals];
          // Sort goals chronologically by target date
          return combined.sort((a, b) => {
            return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
          });
        });
        
        toast({
          title: "Success",
          description: `Added ${updates.length} new goal(s)`,
        });
      } catch (error) {
        console.error('Error saving goals:', error);
        
        toast({
          title: "Error",
          description: "Failed to save goals to database",
          variant: "destructive",
        });
      } finally {
        setIsUpdating(false);
      }
    };
    
    processUpdates();
  }, [updates, toast]);

  const handleEditGoal = async (updatedGoal: Goal) => {
    try {
      setIsUpdating(true);
      await DatabaseService.saveGoals([{
        id: updatedGoal.id,
        title: updatedGoal.title,
        description: updatedGoal.description,
        target_date: updatedGoal.target_date,
        progress: updatedGoal.progress,
        category: updatedGoal.category
      }]);
      
      setGoals(prev => prev.map(goal => 
        goal.id === updatedGoal.id ? updatedGoal : goal
      ));
      
      toast({
        title: "Success",
        description: "Goal updated successfully",
      });
    } catch (error) {
      console.error('Error updating goal:', error);
      toast({
        title: "Error",
        description: "Failed to update goal",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
      setEditingGoal(null);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      setIsUpdating(true);
      await DatabaseService.deleteGoal(goalId);
      
      setGoals(prev => prev.filter(goal => goal.id !== goalId));
      
      toast({
        title: "Success",
        description: "Goal deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast({
        title: "Error",
        description: "Failed to delete goal",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Calculate how far in the future the date is
  const getTimeUntil = (dateString: string) => {
    const now = new Date();
    const targetDate = new Date(dateString);
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Past due';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
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
          <Target className="h-5 w-5" />
          <span>Goals</span>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={toggleExpandedView} className="ml-auto">
          <Maximize2 className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className={cn(
        "flex-1 overflow-y-auto pb-6",
        isExpanded && "px-6"
      )}>
        {goals.length > 0 ? (
          <div className="space-y-4">
            {goals.map((goal) => (
              <div 
                key={goal.id}
                className={cn(
                  "flex flex-col p-3 rounded-lg border border-border/50",
                  "hover:bg-muted/50 hover:border-border transition-all",
                  "text-foreground",
                  goal.id === goals[goals.length - 1]?.id && activeQuery && "animate-in fade-in-50 slide-in-from-bottom-3"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{goal.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {goal.category && (
                      <Badge variant="outline" className="text-xs">
                        {goal.category}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingGoal(goal)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteGoal(goal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {goal.description && (
                  <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    <span>{formatDate(goal.target_date)}</span>
                  </div>
                  <span className="text-xs font-medium">
                    {getTimeUntil(goal.target_date)}
                  </span>
                </div>
                {typeof goal.progress === 'number' && (
                  <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                    <div 
                      className="bg-primary h-1.5 rounded-full" 
                      style={{ width: `${Math.min(Math.max(goal.progress, 0), 100)}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-medium mb-2">Set your goals</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Tell the AI about goals you&apos;d like to achieve and track your progress.
            </p>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingGoal} onOpenChange={() => setEditingGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          {editingGoal && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleEditGoal({
                ...editingGoal,
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                target_date: formData.get('target_date') as string,
                progress: Number(formData.get('progress')),
                category: formData.get('category') as string,
              });
            }}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={editingGoal.title}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingGoal.description}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="target_date">Target Date</Label>
                  <Input
                    id="target_date"
                    name="target_date"
                    type="date"
                    defaultValue={editingGoal.target_date}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="progress">Progress (%)</Label>
                  <Input
                    id="progress"
                    name="progress"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={editingGoal.progress}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    name="category"
                    defaultValue={editingGoal.category}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isUpdating}>
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
} 