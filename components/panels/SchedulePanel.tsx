"use client";

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, CalendarClock, ChevronLeft, ChevronRight, Maximize2, Plus, Edit, Trash2, CheckSquare } from 'lucide-react';
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
  type: 'task' | 'event';  // Distinguish between tasks and events
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
  type: 'task' | 'event';
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
    recurrence_rule: item.recurrence_rule,
    type: item.type
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
    recurrence_rule: item.recurrence_rule,
    type: item.type || 'task'  // Ensure type is always set
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
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState<Partial<UIScheduleUpdate>>({
    title: '',
    description: '',
    start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    priority: 'medium',
    all_day: false,
    type: 'task'
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
          recurrence_rule: update.recurrence_rule,
          type: update.type || 'task'
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
  
  // Group items by type and time
  const groupItemsByTypeAndTime = (items: ScheduleItem[]) => {
    const groups: Record<string, Record<string, ScheduleItem[]>> = {
      task: {},
      event: {}
    };
    
    // First group all-day items
    const allDayTasks = items.filter(item => item.all_day && item.type === 'task');
    const allDayEvents = items.filter(item => item.all_day && item.type === 'event');
    
    if (allDayTasks.length > 0) {
      groups.task['All Day'] = allDayTasks;
    }
    if (allDayEvents.length > 0) {
      groups.event['All Day'] = allDayEvents;
    }
    
    // Then group timed items
    items.filter(item => !item.all_day).forEach(item => {
      const timeKey = formatTimeForDisplay(item.start_time).split(' ')[0];
      if (!groups[item.type][timeKey]) {
        groups[item.type][timeKey] = [];
      }
      groups[item.type][timeKey].push(item);
    });
    
    return groups;
  };

  // Handle new task creation
  const handleAddItem = async () => {
    if (!newItem.title || !newItem.start_time) {
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
      const taskToAdd = transformUiItemToDb(newItem);
      
      // Save to database
      await DatabaseService.saveScheduleItems([taskToAdd]);
      
      // Update UI immediately for better UX
      const newItemToAdd: ScheduleItem = {
        id: Date.now().toString(),
        title: newItem.title!, // Use non-null assertion since we validate above
        start_time: newItem.start_time!,
        end_time: newItem.end_time || format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        description: newItem.description,
        priority: newItem.priority as 'high' | 'medium' | 'low' || 'medium',
        all_day: newItem.all_day || false,
        recurrence_rule: taskToAdd.recurrence_rule,
        type: newItem.type || 'task'
      };
      
      setScheduleItems(prev => [...prev, newItemToAdd]);
      
      // Reset the form
      setNewItem({
        title: '',
        description: '',
        start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        end_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        priority: 'medium',
        all_day: false,
        type: 'task'
      });
      
      setShowAddDialog(false);
      
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
  const handleDeleteItem = async (taskId: string) => {
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
          
          <div className="flex items-center gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-2">
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start" 
                        onClick={() => {
                          setNewItem(prev => ({ ...prev, type: 'task' }));
                          setShowAddDialog(true);
                        }}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Task
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start"
                        onClick={() => {
                          setNewItem(prev => ({ ...prev, type: 'event' }));
                          setShowAddDialog(true);
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Event
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New {newItem.type === 'task' ? 'Task' : 'Event'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="title" className="text-right">Title</label>
                    <Input 
                      id="title" 
                      value={newItem.title} 
                      onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                      className="col-span-3"
                      placeholder={newItem.type === 'task' ? "Enter task title..." : "Enter event title..."}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="description" className="text-right">Description</label>
                    <Input 
                      id="description" 
                      value={newItem.description || ''} 
                      onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                      className="col-span-3"
                      placeholder={newItem.type === 'task' ? "Task description..." : "Event description..."}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="start_time" className="text-right">Start</label>
                    <Input 
                      id="start_time" 
                      type="datetime-local" 
                      value={newItem.start_time} 
                      onChange={(e) => setNewItem({...newItem, start_time: e.target.value})}
                      className="col-span-3"
                      disabled={newItem.all_day}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="end_time" className="text-right">End</label>
                    <Input 
                      id="end_time" 
                      type="datetime-local" 
                      value={newItem.end_time} 
                      onChange={(e) => setNewItem({...newItem, end_time: e.target.value})}
                      className="col-span-3"
                      disabled={newItem.all_day}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="all_day" className="text-right">All Day</label>
                    <div className="col-span-3 flex items-center">
                      <Checkbox
                        id="all_day"
                        checked={newItem.all_day}
                        onCheckedChange={(checked) => 
                          setNewItem({...newItem, all_day: checked === true})
                        }
                        className="mr-2"
                      />
                      <label htmlFor="all_day" className="text-sm">
                        This is an all-day {newItem.type}
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="priority" className="text-right">Priority</label>
                    <Select 
                      value={newItem.priority?.toString() || 'medium'} 
                      onValueChange={(value) => setNewItem({
                        ...newItem, 
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
                        value={newItem.recurrence_rule || 'none'} 
                        onValueChange={(value) => {
                          if (value === 'none') {
                            setNewItem({
                              ...newItem, 
                              recurrence_rule: undefined
                            });
                          } else {
                            let recurrenceRule = `FREQ=${value.toUpperCase()};INTERVAL=1`;
                            setNewItem({
                              ...newItem, 
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
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddItem}>Add {newItem.type === 'task' ? 'Task' : 'Event'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={toggleExpandedView}>
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2">
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
        </div>
      </CardHeader>
      <CardContent className={cn(
        "flex-1 overflow-y-auto pb-6",
        isExpanded && "px-6"
      )}>
        {viewMode === 'day' ? (
          <div className={isExpanded ? "max-w-4xl mx-auto h-full" : "h-full"}>
            {getItemsForDate(currentDate).length > 0 ? (
              <div className="space-y-8">
                {/* Tasks Section */}
                {Object.entries(groupItemsByTypeAndTime(getItemsForDate(currentDate)).task).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Tasks
                    </h3>
                    {Object.entries(groupItemsByTypeAndTime(getItemsForDate(currentDate)).task).map(([time, items]) => (
                      <div key={time} className={cn("mb-4", isExpanded && "mb-6")}>
                        <div className="flex items-center mb-2">
                          {time === 'All Day' ? (
                            <Calendar className="mr-2 h-4 w-4" />
                          ) : (
                            <Clock className="mr-2 h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">{time}</span>
                        </div>
                        <div className={cn(
                          "grid gap-2",
                          isExpanded ? "grid-cols-2" : "grid-cols-1"
                        )}>
                          {items.map((item) => (
                            <div 
                              key={item.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg transition-all group",
                                "hover:bg-muted/50 border border-border/50",
                                item.id === scheduleItems[scheduleItems.length - 1]?.id && activeQuery && "animate-in fade-in-50 slide-in-from-bottom-3"
                              )}
                            >
                              <div className={cn(
                                "mt-1 h-3 w-3 rounded-full",
                                item.priority === 'high' && "bg-destructive",
                                item.priority === 'medium' && "bg-orange-500",
                                item.priority === 'low' && "bg-green-500"
                              )} />
                              <div className="flex-1">
                                <p className="font-medium">{item.title}</p>
                                {!item.all_day && (
                                  <div className="text-sm text-muted-foreground flex items-center mt-1">
                                    <Clock className="mr-1 h-3 w-3" />
                                    <span>
                                      {formatTimeForDisplay(item.start_time)} - {formatTimeForDisplay(item.end_time)}
                                    </span>
                                  </div>
                                )}
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                )}
                                {item.recurrence_rule && (
                                  <Badge variant="outline" className="mt-2">
                                    {item.recurrence_rule.split(';')[0].split('=')[1].toLowerCase()}
                                  </Badge>
                                )}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Events Section */}
                {Object.entries(groupItemsByTypeAndTime(getItemsForDate(currentDate)).event).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Events
                    </h3>
                    {Object.entries(groupItemsByTypeAndTime(getItemsForDate(currentDate)).event).map(([time, items]) => (
                      <div key={time} className={cn("mb-4", isExpanded && "mb-6")}>
                        <div className="flex items-center mb-2">
                          {time === 'All Day' ? (
                            <Calendar className="mr-2 h-4 w-4" />
                          ) : (
                            <Clock className="mr-2 h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">{time}</span>
                        </div>
                        <div className={cn(
                          "grid gap-2",
                          isExpanded ? "grid-cols-2" : "grid-cols-1"
                        )}>
                          {items.map((item) => (
                            <div 
                              key={item.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg transition-all group",
                                "hover:bg-muted/50 border border-border/50",
                                item.id === scheduleItems[scheduleItems.length - 1]?.id && activeQuery && "animate-in fade-in-50 slide-in-from-bottom-3"
                              )}
                            >
                              <div className={cn(
                                "mt-1 h-3 w-3 rounded-full",
                                item.priority === 'high' && "bg-destructive",
                                item.priority === 'medium' && "bg-orange-500",
                                item.priority === 'low' && "bg-green-500"
                              )} />
                              <div className="flex-1">
                                <p className="font-medium">{item.title}</p>
                                {!item.all_day && (
                                  <div className="text-sm text-muted-foreground flex items-center mt-1">
                                    <Clock className="mr-1 h-3 w-3" />
                                    <span>
                                      {formatTimeForDisplay(item.start_time)} - {formatTimeForDisplay(item.end_time)}
                                    </span>
                                  </div>
                                )}
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                )}
                                {item.recurrence_rule && (
                                  <Badge variant="outline" className="mt-2">
                                    {item.recurrence_rule.split(';')[0].split('=')[1].toLowerCase()}
                                  </Badge>
                                )}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <CalendarClock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">No items for {format(currentDate, 'MMMM d')}</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {isToday(currentDate) 
                    ? "Your schedule is clear for today. Add some tasks or events."
                    : `Your schedule is clear for ${format(currentDate, 'MMMM d')}. Add some tasks or events.`
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
                              handleDeleteItem(item.id);
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