"use client";

import { useState, useEffect } from 'react';
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
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInMinutes, isToday, getDay } from 'date-fns';
import { DayOfWeek } from '@/lib/supabase';

interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  date?: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  duration?: number; // Duration in minutes
  recurring?: 'daily' | 'weekly' | 'monthly' | null;
  repeat_days?: DayOfWeek[]; // Specific days to repeat on
}

interface ScheduleUpdate {
  title: string;
  date: string;
  time: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  duration?: number; // Duration in minutes
  recurring?: 'daily' | 'weekly' | 'monthly' | null;
  repeat_days?: DayOfWeek[]; // Specific days to repeat on
}

interface SchedulePanelProps {
  activeQuery: string;
  updates?: ScheduleUpdate[];
}

// Map numeric day of week to day name
const dayMapping: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday'
};

export function SchedulePanel({ activeQuery, updates = [] }: SchedulePanelProps) {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [expandedView, setExpandedView] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState<Partial<ScheduleUpdate>>({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    priority: 'medium',
    duration: 60,
    recurring: null,
    repeat_days: []
  });
  const { toast } = useToast();
  
  // Load initial data from database
  useEffect(() => {
    const loadScheduleItems = async () => {
      try {
        setIsLoadingDB(true);
        const items = await DatabaseService.getScheduleItems();
        setScheduleItems(items);
      } catch (error) {
        console.error('Error loading schedule items:', error);
      } finally {
        setIsLoadingDB(false);
      }
    };
    
    loadScheduleItems();
  }, []);
  
  // Process updates from GPT-4
  useEffect(() => {
    if (!updates?.length) return;
    
    setIsUpdating(true);
    
    // Process updates from GPT-4 and save to database
    const processUpdates = async () => {
      try {
        // Save to database
        await DatabaseService.saveScheduleItems(updates);
        
        // Update UI with new items
        const newItems = updates.map(update => ({
          id: Date.now() + Math.random().toString(),
          title: update.title,
          time: `${update.time}${update.date ? ` (${update.date})` : ''}`,
          date: update.date,
          description: update.description,
          priority: update.priority,
          duration: update.duration || 60,
          recurring: update.recurring,
          repeat_days: update.repeat_days
        }));
        
        setScheduleItems(prev => [...prev, ...newItems]);
        
        toast({
          title: "Success",
          description: `Added ${updates.length} new schedule item(s)`,
        });
      } catch (error) {
        console.error('Error saving schedule items:', error);
        
        toast({
          title: "Error",
          description: "Failed to save schedule items to database",
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
    
    // Simulate updating schedule based on AI response
    if (activeQuery.toLowerCase().includes('schedule') || 
        activeQuery.toLowerCase().includes('meeting') || 
        activeQuery.toLowerCase().includes('appointment')) {
      setIsUpdating(true);
      
      // Simulate delay for AI processing
      setTimeout(() => {
        // Generate a new item based on the query
        if (activeQuery.toLowerCase().includes('gym')) {
          setScheduleItems(prev => [
            ...prev, 
            { 
              id: Date.now().toString(), 
              title: 'Gym Workout', 
              time: '6:30 PM', 
              priority: 'medium',
              duration: 60
            }
          ]);
        } else if (activeQuery.toLowerCase().includes('presentation')) {
          setScheduleItems(prev => [
            ...prev, 
            { 
              id: Date.now().toString(), 
              title: 'Prepare Presentation', 
              time: '2:00 PM', 
              priority: 'high',
              duration: 120
            }
          ]);
        } else if (activeQuery.toLowerCase().includes('break') || activeQuery.toLowerCase().includes('rest')) {
          setScheduleItems(prev => [
            ...prev, 
            { 
              id: Date.now().toString(), 
              title: 'Break Time', 
              time: '3:30 PM', 
              priority: 'low',
              duration: 30
            }
          ]);
        }
        
        setIsUpdating(false);
      }, 1500);
    }
  }, [activeQuery, updates]);

  // Check if a task should be shown on the given date based on recurrence rules
  const shouldShowOnDate = (item: ScheduleItem, date: Date): boolean => {
    // For recurring items or items with a matching date
    if (item.recurring === 'daily') {
      return true;
    }
    
    // For weekly recurring with specific days
    if (item.recurring === 'weekly' && item.repeat_days && item.repeat_days.length > 0) {
      const dayName = dayMapping[getDay(date)];
      return item.repeat_days.includes(dayName);
    }
    
    // Old way - for backward compatibility
    if (item.recurring === 'weekly' && !item.repeat_days) {
      const itemDate = item.date ? new Date(item.date) : new Date();
      return itemDate.getDay() === date.getDay();
    }
    
    if (item.recurring === 'monthly') {
      const itemDate = item.date ? new Date(item.date) : new Date();
      return itemDate.getDate() === date.getDate();
    }
    
    // Non-recurring items - exact date match
    const formattedDate = format(date, 'yyyy-MM-dd');
    return item.date === formattedDate;
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
  const toggleExpandedView = () => setExpandedView(prev => !prev);
  
  // Group items by time when displaying for the day
  const groupItemsByTime = (items: ScheduleItem[]) => {
    const groups: Record<string, ScheduleItem[]> = {};
    
    items.forEach(item => {
      // Extract just the time part (ignore date)
      const timeKey = item.time.split(' ')[0];
      if (!groups[timeKey]) {
        groups[timeKey] = [];
      }
      groups[timeKey].push(item);
    });
    
    return groups;
  };

  // Handle new task creation
  const handleAddTask = async () => {
    if (!newTask.title || !newTask.time) {
      toast({
        title: "Error",
        description: "Please provide a title and time for the task",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdating(true);
      
      // Format the date and time for the database
      const timeString = `${newTask.time}${newTask.date ? ` (${newTask.date})` : ''}`;
      
      const taskToAdd: ScheduleUpdate = {
        title: newTask.title,
        date: newTask.date || format(new Date(), 'yyyy-MM-dd'),
        time: newTask.time || '12:00',
        description: newTask.description || '',
        priority: newTask.priority as 'high' | 'medium' | 'low' || 'medium',
        duration: newTask.duration,
        recurring: newTask.recurring,
        repeat_days: newTask.repeat_days
      };
      
      // Save to database
      await DatabaseService.saveScheduleItems([taskToAdd]);
      
      // Add to UI - make sure all required fields are filled
      const newItemToAdd: ScheduleItem = {
        id: Date.now().toString(),
        title: newTask.title!, // Use non-null assertion since we validate above
        time: timeString,
        date: newTask.date,
        description: newTask.description,
        priority: newTask.priority as 'high' | 'medium' | 'low' || 'medium',
        duration: newTask.duration,
        recurring: newTask.recurring,
        repeat_days: newTask.repeat_days
      };
      
      setScheduleItems(prev => [...prev, newItemToAdd]);
      
      // Reset form
      setNewTask({
        title: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        priority: 'medium',
        duration: 60,
        recurring: null,
        repeat_days: []
      });
      
      setShowAddTaskDialog(false);
      
      toast({
        title: "Success",
        description: "Task added successfully",
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
  const handleDeleteTask = async (id: string) => {
    try {
      setIsUpdating(true);
      
      // Delete from database
      await DatabaseService.deleteScheduleItem(id);
      
      // Update UI
      setScheduleItems(prev => prev.filter(item => item.id !== id));
      
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle day selection for repeat_days
  const toggleDaySelection = (day: DayOfWeek) => {
    setNewTask(prev => {
      const currentDays = prev.repeat_days || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      
      return {
        ...prev,
        repeat_days: newDays
      };
    });
  };

  return (
    <Card 
      className={cn(
        "border border-border/40 bg-background/60 backdrop-blur-sm transition-all duration-300",
        "hover:shadow-md overflow-hidden flex flex-col",
        isUpdating && "animate-pulse",
        expandedView && "fixed inset-10 z-50"
      )}
      style={{ 
        height: expandedView ? 'calc(100vh - 5rem)' : '100%' 
      }}
    >
      <CardHeader className="flex flex-col space-y-2 pb-2">
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
          "flex items-center gap-1",
          expandedView ? "justify-center" : "justify-between"
        )}>
          <Button variant="outline" size="sm" onClick={viewMode === 'day' ? goToPrevDay : goToPrevWeek}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          
          <Badge variant="outline" className="font-normal text-center px-3 py-1 min-w-28">
            {viewMode === 'day' 
              ? format(currentDate, 'MMM d, yyyy')
              : `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d')}`
            }
          </Badge>
          
          <Button variant="outline" size="sm" onClick={viewMode === 'day' ? goToNextDay : goToNextWeek}>
            <ChevronRight className="h-3 w-3" />
          </Button>
          
          {expandedView && (
            <Button variant="outline" size="sm" onClick={toggleViewMode} className="min-w-16 ml-4">
              <span className="text-xs font-normal">
                {viewMode === 'day' ? 'Day' : 'Week'}
              </span>
            </Button>
          )}
          
          <div className={expandedView ? "ml-4" : "ml-auto"}>
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
                    <label htmlFor="date" className="text-right">Date</label>
                    <Input 
                      id="date" 
                      type="date" 
                      value={newTask.date} 
                      onChange={(e) => setNewTask({...newTask, date: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="time" className="text-right">Time</label>
                    <Input 
                      id="time" 
                      type="time" 
                      value={newTask.time} 
                      onChange={(e) => setNewTask({...newTask, time: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="duration" className="text-right">Duration (min)</label>
                    <Input 
                      id="duration" 
                      type="number" 
                      value={newTask.duration?.toString() || '60'} 
                      onChange={(e) => setNewTask({...newTask, duration: parseInt(e.target.value) || 60})}
                      className="col-span-3"
                    />
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
                    <label htmlFor="recurring" className="text-right">Repeat</label>
                    <Select 
                      value={newTask.recurring || 'none'} 
                      onValueChange={(value) => setNewTask({
                        ...newTask, 
                        recurring: value === 'none' ? null : value as 'daily' | 'weekly' | 'monthly'
                      })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select recurrence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {newTask.recurring === 'weekly' && (
                    <div className="grid grid-cols-4 items-start gap-4">
                      <label className="text-right pt-2">Repeat on</label>
                      <div className="col-span-3 flex flex-col gap-2">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                          <div key={day} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`day-${day}`} 
                              checked={(newTask.repeat_days || []).includes(day as DayOfWeek)}
                              onCheckedChange={() => toggleDaySelection(day as DayOfWeek)}
                            />
                            <label 
                              htmlFor={`day-${day}`} 
                              className="text-sm font-medium capitalize leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {day}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
        expandedView && "px-6"
      )}>
        {viewMode === 'day' ? (
          // Day view with items grouped by time
          <div className={expandedView ? "max-w-4xl mx-auto" : ""}>
            {scheduleItems.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupItemsByTime(getItemsForDate(currentDate))).map(([time, items]) => (
                  <div key={time} className={cn("mb-4", expandedView && "mb-6")}>
                    <div className="flex items-center mb-2">
                      <Clock className="mr-1 h-3 w-3" />
                      <span className="text-sm font-medium">{time}</span>
                    </div>
                    <div className={cn(
                      "flex flex-wrap gap-2",
                      expandedView && "gap-4"
                    )}>
                      {items.map((item) => (
                        <div 
                          key={item.id}
                          className={cn(
                            "flex-1 flex items-start gap-3 p-3 rounded-lg transition-all group",
                            "hover:bg-muted/50",
                            expandedView && "p-4",
                            item.id === scheduleItems[scheduleItems.length - 1]?.id && activeQuery && "animate-in fade-in-50 slide-in-from-bottom-3"
                          )}
                          style={{
                            minHeight: `${Math.max(80, (item.duration || 60) / 15 * 20)}px`, // Scale height based on duration
                            minWidth: items.length > 1 ? (expandedView ? 'calc(50% - 1rem)' : 'calc(50% - 0.5rem)') : '100%' // Side by side if multiple items
                          }}
                        >
                          <div className={cn(
                            "mt-0.5 h-4 w-4 rounded-full",
                            item.priority === 'high' && "bg-destructive",
                            item.priority === 'medium' && "bg-orange-500",
                            item.priority === 'low' && "bg-green-500"
                          )} />
                          <div className="flex-1 space-y-1">
                            <p className="font-medium leading-none">{item.title}</p>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="mr-1 h-3 w-3" />
                              <span>{item.time}</span>
                              {item.recurring && (
                                <Badge className="ml-2" variant="outline">
                                  {item.recurring}
                                  {item.recurring === 'weekly' && item.repeat_days && item.repeat_days.length > 0 && (
                                    <span className="ml-1">({item.repeat_days.map(d => d.charAt(0).toUpperCase()).join(',')})</span>
                                  )}
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
                <h3 className="text-xl font-medium mb-2">No events scheduled</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Tell the AI about your events or click the + button to add tasks.
                </p>
              </div>
            )}
          </div>
        ) : (
          // Week view
          <div className={cn(
            "grid grid-cols-7 gap-2",
            expandedView && "gap-4"
          )}>
            {weekDays.map((day) => (
              <div key={format(day, 'yyyy-MM-dd')} className="flex flex-col">
                <div className={cn(
                  "text-center mb-2 font-medium",
                  isToday(day) && "text-primary"
                )}>
                  {format(day, 'EEE')}
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'MMM d')}
                  </div>
                </div>
                <div className={cn(
                  "flex-1 overflow-hidden border rounded-md p-1",
                  expandedView && "p-2",
                  isToday(day) && "border-primary/50 bg-primary/5"
                )} style={{ minHeight: expandedView ? '300px' : '200px' }}>
                  {getItemsForDate(day).length > 0 ? (
                    <div className="space-y-1">
                      {getItemsForDate(day).map((item) => (
                        <div 
                          key={`${format(day, 'yyyy-MM-dd')}-${item.id}`}
                          className={cn(
                            "flex items-start gap-1 p-1 rounded-sm text-xs group relative",
                            "hover:bg-muted/50",
                            item.priority === 'high' && "border-l-2 border-destructive",
                            item.priority === 'medium' && "border-l-2 border-orange-500",
                            item.priority === 'low' && "border-l-2 border-green-500"
                          )}
                          style={{
                            height: `${Math.max(24, (item.duration || 60) / 30 * 12)}px`, // Scale height based on duration
                          }}
                        >
                          <div className="truncate flex-1">
                            <span className="font-medium">{item.title}</span>
                            <span className="text-muted-foreground ml-1">
                              {item.time.split(' ')[0]}
                            </span>
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