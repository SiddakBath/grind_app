"use client";

import { useState, useEffect } from 'react';
import { SchedulePanel } from '@/components/panels/SchedulePanel';
import { IdeasPanel } from '@/components/panels/IdeasPanel';
import { GoalsPanel } from '@/components/panels/GoalsPanel';

type CategoryData = {
  scheduleUpdates: any[];
  ideasUpdates: any[];
  goalsUpdates: any[];
};

type PanelType = 'schedule' | 'ideas' | 'goals' | null;

export function DashboardPanels() {
  const [activeQuery, setActiveQuery] = useState('');
  const [expandedPanel, setExpandedPanel] = useState<PanelType>(null);
  const [categoryData, setCategoryData] = useState<CategoryData>({
    scheduleUpdates: [],
    ideasUpdates: [],
    goalsUpdates: []
  });
  
  useEffect(() => {
    const handleAiResponse = (event: CustomEvent) => {
      setActiveQuery(event.detail.query);
      
      // Update categories with data from AI response
      setCategoryData({
        scheduleUpdates: event.detail.scheduleUpdates || [],
        ideasUpdates: event.detail.ideasUpdates || [],
        goalsUpdates: event.detail.goalsUpdates || []
      });
    };

    window.addEventListener('ai-response', handleAiResponse as EventListener);
    
    return () => {
      window.removeEventListener('ai-response', handleAiResponse as EventListener);
    };
  }, []);

  const panelClasses = "h-full transform transition-all duration-300 ease-in-out hover:scale-105 rounded-lg shadow-md hover:shadow-lg bg-opacity-95 hover:bg-opacity-100";

  const handlePanelExpand = (panel: PanelType, isExpanded: boolean) => {
    setExpandedPanel(isExpanded ? panel : null);
  };

  // If a panel is expanded, render it outside the grid
  if (expandedPanel) {
    return (
      <div className="fixed inset-4 z-50">
        {expandedPanel === 'schedule' && (
          <SchedulePanel 
            activeQuery={activeQuery} 
            updates={categoryData.scheduleUpdates}
            onExpandToggle={(isExpanded) => handlePanelExpand('schedule', isExpanded)}
            isExpanded={true}
          />
        )}
        {expandedPanel === 'ideas' && (
          <IdeasPanel 
            activeQuery={activeQuery} 
            updates={categoryData.ideasUpdates}
            onExpandToggle={(isExpanded) => handlePanelExpand('ideas', isExpanded)}
            isExpanded={true}
          />
        )}
        {expandedPanel === 'goals' && (
          <GoalsPanel 
            activeQuery={activeQuery} 
            updates={categoryData.goalsUpdates}
            onExpandToggle={(isExpanded) => handlePanelExpand('goals', isExpanded)}
            isExpanded={true}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 min-h-[600px] w-full">
      <div className={`${panelClasses} border border-blue-300/50 dark:border-blue-500/50 shadow-blue-300/70 hover:shadow-blue-400/80 w-full`}>
        <SchedulePanel 
          activeQuery={activeQuery} 
          updates={categoryData.scheduleUpdates}
          onExpandToggle={(isExpanded) => handlePanelExpand('schedule', isExpanded)}
          isExpanded={false}
        />
      </div>
      <div className={`${panelClasses} border border-purple-300/50 dark:border-purple-500/50 shadow-purple-300/70 hover:shadow-purple-400/80 w-full`}>
        <IdeasPanel 
          activeQuery={activeQuery} 
          updates={categoryData.ideasUpdates}
          onExpandToggle={(isExpanded) => handlePanelExpand('ideas', isExpanded)}
          isExpanded={false}
        />
      </div>
      <div className={`${panelClasses} border border-green-300/50 dark:border-green-500/50 shadow-green-300/70 hover:shadow-green-400/80 w-full`}>
        <GoalsPanel 
          activeQuery={activeQuery} 
          updates={categoryData.goalsUpdates}
          onExpandToggle={(isExpanded) => handlePanelExpand('goals', isExpanded)}
          isExpanded={false}
        />
      </div>
    </div>
  );
}