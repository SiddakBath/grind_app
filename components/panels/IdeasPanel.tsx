"use client";

import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Plus, Sparkles, PlusCircle, Maximize2, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DatabaseService } from '@/lib/database-service';
import { useToast } from '@/hooks/use-toast';
import { EVENTS } from '@/app/supabase-provider';

interface Idea {
  id: string;
  content: string;
  createdAt: Date | string;
}

interface IdeasPanelProps {
  activeQuery: string;
  updates?: any[];
  isExpanded?: boolean;
  onExpandToggle?: (isExpanded: boolean) => void;
}

export function IdeasPanel({ activeQuery, updates = [], isExpanded = false, onExpandToggle }: IdeasPanelProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdeaContent, setNewIdeaContent] = useState('');
  const [isAddingIdea, setIsAddingIdea] = useState(false);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Function to load ideas from database
  const loadIdeas = useCallback(async () => {
    try {
      setIsLoadingDB(true);
      const items = await DatabaseService.getIdeas();
      // Convert database format to component format
      const formattedIdeas = items.map(item => ({
        id: item.id,
        content: item.content,
        createdAt: item.created_at
      }));
      setIdeas(formattedIdeas);
    } catch (error) {
      console.error('Error loading ideas:', error);
      toast({
        title: "Error",
        description: "Failed to refresh ideas",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDB(false);
    }
  }, [toast]);
  
  // Load initial data from database
  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);
  
  // Handle real-time updates
  const handleRealtimeUpdate = useCallback(() => {
    console.log('Ideas updated, refreshing data...');
    loadIdeas().catch(err => {
      console.error('Error refreshing ideas data:', err);
    });
  }, [loadIdeas]);
  
  // Listen for real-time updates
  useEffect(() => {
    // Add event listener for real-time updates
    window.addEventListener(EVENTS.IDEAS_UPDATED, handleRealtimeUpdate);
    
    // Clean up event listener
    return () => {
      window.removeEventListener(EVENTS.IDEAS_UPDATED, handleRealtimeUpdate);
    };
  }, [handleRealtimeUpdate]);
  
  // Process updates from GPT-4
  useEffect(() => {
    if (!updates?.length) return;
    
    setIsUpdating(true);
    
    // Process updates from GPT-4 and save to database
    const processUpdates = async () => {
      try {
        // Convert to format expected by database service
        const ideaUpdates = updates.map(update => ({
          content: update.content || update.idea || update.text || update.description,
          title: update.title
        }));
        
        // Save to database
        await DatabaseService.saveIdeas(ideaUpdates);
        
        // Update UI with new items
        const newIdeas = ideaUpdates.map(update => ({
          id: Date.now() + Math.random().toString(),
          content: update.content,
          createdAt: new Date()
        }));
        
        setIdeas(prev => [...prev, ...newIdeas]);
        
        toast({
          title: "Success",
          description: `Added ${updates.length} new idea(s)`,
        });
      } catch (error) {
        console.error('Error saving ideas:', error);
        
        toast({
          title: "Error",
          description: "Failed to save ideas to database",
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
    
    // Simulate updating ideas based on AI response
    if (activeQuery.toLowerCase().includes('idea') || 
        activeQuery.toLowerCase().includes('note') || 
        activeQuery.toLowerCase().includes('thought') ||
        activeQuery.toLowerCase().includes('remember')) {
      setIsUpdating(true);
      
      // Simulate delay for AI processing
      setTimeout(() => {
        // Generate a new item based on the query
        let newIdea = "";
        
        if (activeQuery.toLowerCase().includes('project')) {
          newIdea = "Create a project timeline with key milestones and deliverables";
        } else if (activeQuery.toLowerCase().includes('feature')) {
          newIdea = "Implement new feature: user preference settings with dark mode toggle";
        } else if (activeQuery.toLowerCase().includes('blog')) {
          newIdea = "Write a blog post about the latest industry trends and innovations";
        } else if (activeQuery.toLowerCase().includes('remember')) {
          const match = activeQuery.match(/remember\s+(to\s+)?(.+)/i);
          if (match && match[2]) {
            newIdea = match[2].trim();
          } else {
            newIdea = "Follow up on yesterday's client meeting";
          }
        } else {
          newIdea = "Explore new collaboration tools to improve team communication";
        }
        
        if (newIdea) {
          setIdeas(prev => [
            ...prev, 
            { 
              id: Date.now().toString(), 
              content: newIdea, 
              createdAt: new Date() 
            }
          ]);
        }
        
        setIsUpdating(false);
      }, 1500);
    }
  }, [activeQuery, updates]);

  // Function to delete an idea
  const handleDeleteIdea = async (id: string) => {
    try {
      setIsDeleting(id);
      await DatabaseService.deleteIdea(id);
      
      // Update the UI
      setIdeas(prev => prev.filter(idea => idea.id !== id));
      
      toast({
        title: "Success",
        description: "Idea deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting idea:', error);
      toast({
        title: "Error",
        description: "Failed to delete idea",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  // Function to handle adding a new idea
  const handleAddIdea = async () => {
    if (!newIdeaContent.trim()) return;
    
    try {
      setIsAddingIdea(true);
      
      // Save to database
      await DatabaseService.saveIdeas([{ content: newIdeaContent.trim() }]);
      
      // Clear input
      setNewIdeaContent('');
      
      // Refresh ideas list
      await loadIdeas();
      
      toast({
        title: "Success",
        description: "Idea added successfully",
      });
    } catch (error) {
      console.error('Error adding idea:', error);
      toast({
        title: "Error",
        description: "Failed to add idea",
        variant: "destructive",
      });
    } finally {
      setIsAddingIdea(false);
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
          <Lightbulb className="h-5 w-5" />
          <span>Ideas</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newIdeaContent}
              onChange={(e) => setNewIdeaContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddIdea();
                }
              }}
              placeholder="Add new idea..."
              className="w-48 h-8 px-2 text-sm rounded-md border border-border/50 bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={isAddingIdea}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={handleAddIdea}
              disabled={isAddingIdea || !newIdeaContent.trim()}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add idea</span>
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={toggleExpandedView} className="ml-auto">
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn(
        "flex-1 overflow-y-auto pb-6",
        isExpanded && "px-6"
      )}>
        {ideas.length > 0 ? (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <div 
                key={idea.id}
                className={cn(
                  "p-3 rounded-lg border border-border/50 transition-all",
                  "hover:bg-muted/50 hover:border-border",
                  idea.id === ideas[ideas.length - 1]?.id && activeQuery && "animate-in fade-in-50 slide-in-from-bottom-3",
                  isDeleting === idea.id && "opacity-50"
                )}
              >
                <div className="flex justify-between items-start">
                  <p className="text-sm">{idea.content}</p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-40 hover:opacity-100"
                    onClick={() => handleDeleteIdea(idea.id)}
                    disabled={isDeleting === idea.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Delete idea</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {typeof idea.createdAt === 'string' 
                    ? new Date(idea.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : idea.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-medium mb-2">Inspiration awaits</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Chat with the AI to capture your ideas and insights.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}