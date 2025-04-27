"use client";

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, CalendarClock, ChevronLeft, ChevronRight, Maximize2, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DatabaseService } from '@/lib/database-service';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInMinutes, isToday, getDay, parseISO } from 'date-fns';
import { ScheduleItem as SupabaseScheduleItem } from '@/lib/supabase';
import { ScheduleUpdate } from '@/lib/ai-service';
import { EVENTS } from '@/app/supabase-provider';

// Local interface for working with schedule items in the UI
interface ScheduleItem {
  id: string;
  title: string;
  description?: string | null;
  priority: 'high' | 'medium' | 'low' | null;
  start_time: string;  // ISO format timestamp
  end_time: string;    // ISO format timestamp
  all_day: boolean;
  recurrence_rule?: string | null;  // iCal format
}

// Define a UI-specific interface instead of extending the ScheduleUpdate
interface UIScheduleUpdate {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  recurrence_rule?: string;
}

// Transform database items to UI format
function transformDbItemToUi(item: SupabaseScheduleItem): ScheduleItem {
  return {
    id: item.id,
    title: item.title,
    start_time: item.start_time,
    end_time: item.end_time,
    all_day: item.all_day,
    description: item.description,
    priority: item.priority,
    recurrence_rule: item.recurrence_rule
  };
}

// Transform UI item to database format
function transformUiItemToDb(item: Partial<UIScheduleUpdate>): ScheduleUpdate {
  return {
    title: item.title || '',
    description: item.description,
    start_time: item.start_time,
    end_time: item.end_time,
    all_day: item.all_day,
    priority: item.priority,
    recurrence_rule: item.recurrence_rule
  };
}

// Map numeric day of week to day name
const dayMapping: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday'
};

interface SchedulePanelProps {
  activeQuery: string;
  updates?: ScheduleUpdate[];
  isExpanded?: boolean;
  onExpandToggle?: (isExpanded: boolean) => void;
}

// Calculate duration in minutes between two times
function calculateDuration(startTime: string, endTime: string): number {
  // Handle full ISO timestamps
  const startStr = startTime.includes('T') ? startTime.split('T')[1].substring(0, 5) : startTime;
  const endStr = endTime.includes('T') ? endTime.split('T')[1].substring(0, 5) : endTime;
  
  // Parse time strings
  const [startHours, startMinutes] = startStr.split(':').map(Number);
  const [endHours, endMinutes] = endStr.split(':').map(Number);
  
  // Calculate total minutes
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes - startTotalMinutes;
}

// Format time for display (12-hour format)
function formatTimeForDisplay(time: string): string {
  // Extract time portion from ISO string if it's a full timestamp
  const timeStr = time.includes('T') ? time.split('T')[1].substring(0, 5) : time;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function SchedulePanel({ activeQuery, updates = [], isExpanded = false, onExpandToggle }: SchedulePanelProps) {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState<Partial<UIScheduleUpdate>>({
    title: '',
    description: '',
    start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    priority: 'medium',
    all_day: false
  });
  const { toast } = useToast();
  
  // Function to load schedule items from database
  const loadScheduleItems = useCallback(async () => {
    try {
      setIsLoadingDB(true);
      const dbItems = await DatabaseService.getScheduleItems();
      
      // Transform database items to UI format
      const uiItems: ScheduleItem[] = dbItems.map(transformDbItemToUi);
      setScheduleItems(uiItems);
    } catch (error) {
      console.error('Error loading schedule items:', error);
      toast({
        title: "Error",
        description: "Failed to refresh schedule items",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDB(false);
    }
  }, [toast]);
  
  // Load initial data from database
  useEffect(() => {
    loadScheduleItems();
  }, [loadScheduleItems]);
  
  // Handle real-time updates
  const handleRealtimeUpdate = useCallback(() => {
    console.log('Schedule items updated, refreshing data...');
    loadScheduleItems().catch(err => {
      console.error('Error refreshing schedule data:', err);
    });
  }, [loadScheduleItems]);
  
  // Listen for real-time updates
  useEffect(() => {
    // Setup event listener for real-time updates
    window.addEventListener(EVENTS.SCHEDULE_UPDATED, handleRealtimeUpdate);
    
    return () => {
      window.removeEventListener(EVENTS.SCHEDULE_UPDATED, handleRealtimeUpdate);
    };
  }, [handleRealtimeUpdate]);
  
  // Add updates from props if they exist
  useEffect(() => {
    if (updates.length > 0) {
      const newItems: ScheduleItem[] = updates.map(update => {
        return {
          id: Date.now().toString() + Math.random().toString(36).substring(2),
          title: update.title,
          start_time: update.start_time || "12:00",
          end_time: update.end_time || "13:00",
          description: update.description,
          priority: update.priority as 'high' | 'medium' | 'low' || 'medium',
          all_day: update.all_day || false,
          recurrence_rule: update.recurrence_rule
        };
      });
      
      setScheduleItems(prev => [...prev, ...newItems]);
    }
  }, [updates]);
  
  // Check if a task should be shown on the given date based on recurrence rules
  const shouldShowOnDate = (item: ScheduleItem, date: Date): boolean => {
    // Extract date from start_time
    const itemDate = parseISO(item.start_time);
    const formattedItemDate = format(itemDate, 'yyyy-MM-dd');
    const formattedTargetDate = format(date, 'yyyy-MM-dd');

    // For all-day events, check date only
    if (item.all_day) {
      return formattedItemDate === formattedTargetDate;
    }

    // Check recurrence rule if available
    if (item.recurrence_rule) {
      const ruleParts = item.recurrence_rule.split(';');
      const freqPart = ruleParts.find(p => p.startsWith('FREQ='));

      if (freqPart) {
        const freq = freqPart.split('=')[1];

        // Daily events always show
        if (freq === 'DAILY') return true;

        // Weekly events with specific days
        if (freq === 'WEEKLY') {
          const bydayPart = ruleParts.find(p => p.startsWith('BYDAY='));
          if (bydayPart) {
            const dayAbbrs = bydayPart.split('=')[1].split(',');
            const currentDayAbbr = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][getDay(date)];
            return dayAbbrs.includes(currentDayAbbr);
          } else {
            // Weekly but no specific days - use event's original day of week
            return itemDate.getDay() === date.getDay();
          }
        }

        // Monthly events - check day of month
        if (freq === 'MONTHLY') {
          return itemDate.getDate() === date.getDate();
        }
      }
    }

    // If no recurrence rule, check if the dates match
    return formattedItemDate === formattedTargetDate;
  };
  
  // Helper function to filter schedule items by date
  const getItemsForDate = (date: Date) => {
    return scheduleItems.filter(item => shouldShowOnDate(item, date));
  };
  
  // Get days for the current week
  const weekDays = viewMode === 'week' 
    ? eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      })
    : [currentDate];
  
  // Navigation functions
  const goToNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const goToPrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const goToNextWeek = () => setCurrentDate(prev => addDays(prev, 7));
  const goToPrevWeek = () => setCurrentDate(prev => subDays(prev, 7));
  const toggleViewMode = () => setViewMode(prev => prev === 'day' ? 'week' : 'day');
  const toggleExpandedView = () => {
    if (onExpandToggle) {
      onExpandToggle(!isExpanded);
    }
  };
  
  // Group items by time when displaying for the day
  const groupItemsByTime = (items: ScheduleItem[]) => {
    const groups: Record<string, ScheduleItem[]> = {};
    
    // First group all-day events
    const allDayEvents = items.filter(item => item.all_day);
    if (allDayEvents.length > 0) {
      groups['All Day'] = allDayEvents;
    }
    
    // Then group timed events
    items.filter(item => !item.all_day).forEach(item => {
      // Use formatted start_time for grouping
      const timeKey = formatTimeForDisplay(item.start_time).split(' ')[0];
      if (!groups[timeKey]) {
        groups[timeKey] = [];
      }
      groups[timeKey].push(item);
    });
    
    return groups;
  };

  // Handle new task creation
  const handleAddTask = async () => {
    if (!newTask.title || !newTask.start_time) {
      toast({
        title: "Error",
        description: "Please provide a title and start time for the task",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdating(true);
      
      // Transform to database format and save
      const taskToAdd = transformUiItemToDb(newTask);
      
      // Save to database
      await DatabaseService.saveScheduleItems([taskToAdd]);
      
      // Update UI immediately for better UX
      const newItemToAdd: ScheduleItem = {
        id: Date.now().toString(),
        title: newTask.title!, // Use non-null assertion since we validate above
        start_time: newTask.start_time!,
        end_time: newTask.end_time || format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        description: newTask.description,
        priority: newTask.priority as 'high' | 'medium' | 'low' || 'medium',
        all_day: newTask.all_day || false,
        recurrence_rule: taskToAdd.recurrence_rule
      };
      
      setScheduleItems(prev => [...prev, newItemToAdd]);
      
      // Reset the form
      setNewTask({
        title: '',
        description: '',
        start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        end_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        priority: 'medium',
        all_day: false
      });
      
      setShowAddTaskDialog(false);
      
      toast({
        title: "Task Added",
        description: "New task has been added to your schedule",
      });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add task",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    try {
      await DatabaseService.deleteScheduleItem(taskId);
      setScheduleItems(prev => prev.filter(item => item.id !== taskId));
      
      toast({
        title: "Task Deleted",
        description: "Task has been removed from your schedule",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  return (
    <Card 
      className={cn(
        "border border-border/40 bg-background/60 backdrop-blur-sm transition-all duration-300",
        "hover:shadow-md overflow-hidden flex flex-col",
        isUpdating && "animate-pulse",
        isExpanded && "fixed inset-10 z-50"
      )}
      style={{ 
        height: isExpanded ? 'calc(100vh - 5rem)' : '100%' 
      }}
    >
      <CardHeader className="flex flex-col space-y-4 pb-4">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <span>Schedule</span>
          </CardTitle>
          
          <Button variant="outline" size="sm" onClick={toggleExpandedView} className="ml-auto">
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
        
        <div className={cn(
          "flex items-center gap-2",
          isExpanded ? "justify-center" : "justify-between"
        )}>
          <Button variant="outline" size="sm" onClick={viewMode === 'day' ? goToPrevDay : goToPrevWeek}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          
          <Badge variant="outline" className="font-normal text-center px-4 py-1.5 min-w-32">
            {viewMode === 'day' 
              ? format(currentDate, 'MMM d, yyyy')
              : `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d')}`
            }
          </Badge>
          
          <Button variant="outline" size="sm" onClick={viewMode === 'day' ? goToNextDay : goToNextWeek}>
            <ChevronRight className="h-3 w-3" />
          </Button>
          
          {isExpanded && (
            <Button variant="outline" size="sm" onClick={toggleViewMode} className="min-w-20 ml-4">
              <span className="text-xs font-normal">
                {viewMode === 'day' ? 'Day' : 'Week'}
              </span>
            </Button>
          )}
          
          <div className={isExpanded ? "ml-4" : "ml-auto"}>
            <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="title" className="text-right">Title</label>
                    <Input 
                      id="title" 
                      value={newTask.title} 
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="description" className="text-right">Description</label>
                    <Input 
                      id="description" 
                      value={newTask.description || ''} 
                      onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="start_time" className="text-right">Start</label>
                    <Input 
                      id="start_time" 
                      type="datetime-local" 
                      value={newTask.start_time} 
                      onChange={(e) => setNewTask({...newTask, start_time: e.target.value})}
                      className="col-span-3"
                      disabled={newTask.all_day}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="end_time" className="text-right">End</label>
                    <Input 
                      id="end_time" 
                      type="datetime-local" 
                      value={newTask.end_time} 
                      onChange={(e) => setNewTask({...newTask, end_time: e.target.value})}
                      className="col-span-3"
                      disabled={newTask.all_day}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="all_day" className="text-right">All Day</label>
                    <div className="col-span-3 flex items-center">
                      <Checkbox
                        id="all_day"
                        checked={newTask.all_day}
                        onCheckedChange={(checked) => 
                          setNewTask({...newTask, all_day: checked === true})
                        }
                        className="mr-2"
                      />
                      <label htmlFor="all_day" className="text-sm">
                        This is an all-day event
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="priority" className="text-right">Priority</label>
                    <Select 
                      value={newTask.priority?.toString() || 'medium'} 
                      onValueChange={(value) => setNewTask({
                        ...newTask, 
                        priority: value as 'high' | 'medium' | 'low'
                      })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="recurring" className="text-right">Recurrence</label>
                    <div className="col-span-3">
                      <Select 
                        value={newTask.recurrence_rule || 'none'} 
                        onValueChange={(value) => {
                          if (value === 'none') {
                            setNewTask({
                              ...newTask, 
                              recurrence_rule: undefined
                            });
                          } else {
                            // Convert to RRULE format
                            let recurrenceRule = `FREQ=${value.toUpperCase()};INTERVAL=1`;
                            
                            setNewTask({
                              ...newTask, 
                              recurrence_rule: recurrenceRule
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select recurrence pattern" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddTaskDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddTask}>Add Task</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(
        "flex-1 overflow-y-auto pb-6",
        isExpanded && "px-6"
      )}>
        {viewMode === 'day' ? (
          <div className={isExpanded ? "max-w-4xl mx-auto h-full" : "h-full"}>
            {getItemsForDate(currentDate).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupItemsByTime(getItemsForDate(currentDate))).map(([time, items]) => (
                  <div key={time} className={cn("mb-6", isExpanded && "mb-8")}>
                    <div className="flex items-center mb-3">
                      {time === 'All Day' ? (
                        <Calendar className="mr-2 h-4 w-4" />
                      ) : (
                        <Clock className="mr-2 h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">{time}</span>
                    </div>
                    <div className={cn(
                      "flex flex-wrap gap-3",
                      isExpanded && "gap-4"
                    )}>
                      {items.map((item) => (
                        <div 
                          key={item.id}
                          className={cn(
                            "flex-1 flex items-start gap-3 p-4 rounded-lg transition-all group",
                            "hover:bg-muted/50 border border-border/50",
                            isExpanded && "p-5",
                            item.id === scheduleItems[scheduleItems.length - 1]?.id && activeQuery && "animate-in fade-in-50 slide-in-from-bottom-3"
                          )}
                          style={{
                            minHeight: item.all_day ? '80px' : `${Math.max(80, calculateDuration(item.start_time, item.end_time) / 15 * 20)}px`,
                            minWidth: items.length > 1 ? (isExpanded ? 'calc(50% - 1rem)' : 'calc(50% - 0.75rem)') : '100%',
                            maxHeight: items.length === 1 ? 'auto' : 'none'
                          }}
                        >
                          <div className={cn(
                            "mt-1 h-3 w-3 rounded-full",
                            item.priority === 'high' && "bg-destructive",
                            item.priority === 'medium' && "bg-orange-500",
                            item.priority === 'low' && "bg-green-500"
                          )} />
                          <div className="flex-1 space-y-2">
                            <p className="font-medium leading-none">{item.title}</p>
                            <div className="flex items-center text-sm text-muted-foreground">
                              {item.all_day ? (
                                <span>[All Day]</span>
                              ) : (
                                <>
                                  <Clock className="mr-1 h-3 w-3" />
                                  <span>
                                    {formatTimeForDisplay(item.start_time)} - {formatTimeForDisplay(item.end_time)} ({calculateDuration(item.start_time, item.end_time)} min)
                                  </span>
                                </>
                              )}
                              {item.recurrence_rule && (
                                <Badge className="ml-2" variant="outline">
                                  {item.recurrence_rule.split(';')[0].split('=')[1]}
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(item.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <CalendarClock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">No events for {format(currentDate, 'MMMM d')}</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {isToday(currentDate) 
                    ? "Your schedule is clear for today. Add some tasks or tell the AI about your events."
                    : `Your schedule is clear for ${format(currentDate, 'MMMM d')}. Add some tasks or tell the AI about your events.`
                  }
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className={cn(
            "grid grid-cols-7 gap-3",
            isExpanded && "gap-4"
          )}>
            {weekDays.map((day) => (
              <div key={format(day, 'yyyy-MM-dd')} className="flex flex-col">
                <div className={cn(
                  "text-center mb-3 font-medium",
                  isToday(day) && "text-primary"
                )}>
                  {format(day, 'EEE')}
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'MMM d')}
                  </div>
                </div>
                <div className={cn(
                  "flex-1 overflow-hidden border rounded-md p-2",
                  isExpanded && "p-3",
                  isToday(day) && "border-primary/50 bg-primary/5"
                )} style={{ minHeight: isExpanded ? '300px' : '200px' }}>
                  {getItemsForDate(day).length > 0 ? (
                    <div className="space-y-2">
                      {getItemsForDate(day).map((item) => (
                        <div 
                          key={`${format(day, 'yyyy-MM-dd')}-${item.id}`}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded-sm text-xs group relative",
                            "hover:bg-muted/50 border border-border/50",
                            item.priority === 'high' && "border-l-2 border-destructive",
                            item.priority === 'medium' && "border-l-2 border-orange-500",
                            item.priority === 'low' && "border-l-2 border-green-500"
                          )}
                          style={{
                            height: getItemsForDate(day).length === 1 ? 'auto' : `${Math.max(24, calculateDuration(item.start_time, item.end_time) / 30 * 12)}px`,
                          }}
                        >
                          <div className="truncate flex-1">
                            <span className="font-medium">{item.title}</span>
                            <div className="text-sm text-muted-foreground">
                              {item.all_day ? (
                                '[All Day]'
                              ) : (
                                `${formatTimeForDisplay(item.start_time)} - ${formatTimeForDisplay(item.end_time)} (${calculateDuration(item.start_time, item.end_time)} min)`
                              )}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0 h-4 w-4 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(item.id);
                            }}
                          >
                            <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      No events
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}