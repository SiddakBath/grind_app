"use client";

import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Plus, Sparkles, PlusCircle, Maximize2, Trash2, BookOpen, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DatabaseService, Resource } from '@/lib/database-service';
import { useToast } from '@/hooks/use-toast';
import { EVENTS } from '@/app/supabase-provider';
import { useSupabase } from '@/app/supabase-provider';
import type { Idea as DbIdea } from '@/lib/supabase';

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
  const [resources, setResources] = useState<Resource[]>([]);
  const [newIdeaContent, setNewIdeaContent] = useState('');
  const [isAddingIdea, setIsAddingIdea] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ideas' | 'resources'>('all');
  const { toast } = useToast();
  
  const { session } = useSupabase();
  const userId = session?.user?.id;

  // Function to load ideas and resources from database
  const loadData = useCallback(async () => {
    try {
      setIsLoadingDB(true);
      const [ideaItems, resourceItems] = await Promise.all([
        DatabaseService.getIdeas(),
        DatabaseService.getResources()
      ]);
      
      // Convert database format to component format
      const formattedIdeas = ideaItems.map((item: DbIdea) => ({
        id: item.id,
        content: item.content,
        createdAt: item.created_at
      }));
      
      setIdeas(formattedIdeas);
      setResources(resourceItems);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDB(false);
    }
  }, [toast]);
  
  // Load initial data from database
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Handle real-time updates
  const handleRealtimeUpdate = useCallback(() => {
    console.log('Data updated, refreshing...');
    loadData().catch(err => {
      console.error('Error refreshing data:', err);
    });
  }, [loadData]);
  
  // Listen for real-time updates
  useEffect(() => {
    window.addEventListener(EVENTS.IDEAS_UPDATED, handleRealtimeUpdate);
    window.addEventListener('resources-updated', handleRealtimeUpdate);
    
    return () => {
      window.removeEventListener(EVENTS.IDEAS_UPDATED, handleRealtimeUpdate);
      window.removeEventListener('resources-updated', handleRealtimeUpdate);
    };
  }, [handleRealtimeUpdate]);

  // Process updates from GPT-4
  useEffect(() => {
    if (!updates?.length) return;
    
    setIsUpdating(true);
    
    const processUpdates = async () => {
      try {
        const ideaUpdates = updates
          .filter(update => !update.url) // Filter out resources
          .map(update => ({
            content: update.content || update.idea || update.text || update.description,
            title: update.title
          }));
        
        const resourceUpdates = updates
          .filter(update => update.url) // Filter resources
          .map(update => ({
            title: update.title,
            url: update.url,
            description: update.description,
            category: update.category,
            relevance_score: update.relevance_score
          }));
        
        // Save to database
        if (ideaUpdates.length > 0) {
          await DatabaseService.saveIdeas(ideaUpdates);
        }
        
        if (resourceUpdates.length > 0) {
          await Promise.all(resourceUpdates.map(resource => 
            DatabaseService.createResource(resource)
          ));
        }
        
        // Refresh data
        await loadData();
        
        toast({
          title: "Success",
          description: `Added ${updates.length} new item(s)`,
        });
      } catch (error) {
        console.error('Error saving updates:', error);
        toast({
          title: "Error",
          description: "Failed to save updates to database",
          variant: "destructive",
        });
      } finally {
        setIsUpdating(false);
      }
    };
    
    processUpdates();
  }, [updates, toast, loadData]);

  // Function to delete an idea
  const handleDeleteIdea = async (id: string) => {
    try {
      setIsDeleting(id);
      await DatabaseService.deleteIdea(id);
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

  // Function to delete a resource
  const handleDeleteResource = async (id: string) => {
    try {
      setIsDeleting(id);
      await DatabaseService.deleteResource(id);
      setResources(prev => prev.filter(resource => resource.id !== id));
      toast({
        title: "Success",
        description: "Resource deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast({
        title: "Error",
        description: "Failed to delete resource",
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
      await DatabaseService.saveIdeas([{ content: newIdeaContent.trim() }]);
      setNewIdeaContent('');
      await loadData();
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

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'article':
        return '📄';
      case 'video':
        return '🎥';
      case 'course':
        return '📚';
      case 'tool':
        return '🛠️';
      default:
        return '🔗';
    }
  };

  const filteredItems = [
    ...(filter === 'all' || filter === 'ideas' ? ideas.map(idea => ({
      id: idea.id,
      type: 'idea' as const,
      content: idea.content,
      createdAt: idea.createdAt
    })) : []),
    ...(filter === 'all' || filter === 'resources' ? resources.map(resource => ({
      id: resource.id,
      type: 'resource' as const,
      title: resource.title,
      url: resource.url,
      description: resource.description,
      category: resource.category,
      relevance_score: resource.relevance_score,
      createdAt: resource.created_at
    })) : [])
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
          <span>Ideas & Resources</span>
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
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'ideas' | 'resources')}
            className="h-8 px-2 text-sm rounded-md border border-border/50 bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Items</option>
            <option value="ideas">Ideas Only</option>
            <option value="resources">Resources Only</option>
          </select>
          <Button variant="outline" size="sm" onClick={toggleExpandedView} className="ml-auto">
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn(
        "flex-1 overflow-y-auto pb-6",
        isExpanded && "px-6"
      )}>
        {filteredItems.length > 0 ? (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "p-3 rounded-lg border border-border/50 transition-all",
                  "hover:bg-muted/50 hover:border-border",
                  item.id === filteredItems[filteredItems.length - 1]?.id && activeQuery && "animate-in fade-in-50 slide-in-from-bottom-3",
                  isDeleting === item.id && "opacity-50"
                )}
              >
                {item.type === 'idea' ? (
                  <div className="flex justify-between items-start">
                    <p className="text-sm">{item.content}</p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-40 hover:opacity-100"
                      onClick={() => handleDeleteIdea(item.id)}
                      disabled={isDeleting === item.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete idea</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{getCategoryIcon(item.category)}</span>
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {item.title}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {item.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Relevance: {item.relevance_score}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-40 hover:opacity-100"
                      onClick={() => handleDeleteResource(item.id)}
                      disabled={isDeleting === item.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete resource</span>
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              Chat with the AI to capture your ideas and discover helpful resources.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}