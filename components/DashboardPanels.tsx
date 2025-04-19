"use client";

import { useState, useEffect } from 'react';
import { SchedulePanel } from '@/components/panels/SchedulePanel';
import { IdeasPanel } from '@/components/panels/IdeasPanel';
import { HabitsPanel } from '@/components/panels/HabitsPanel';

type CategoryData = {
  scheduleUpdates: any[];
  ideasUpdates: any[];
  habitsUpdates: any[];
};

export function DashboardPanels() {
  const [activeQuery, setActiveQuery] = useState('');
  const [categoryData, setCategoryData] = useState<CategoryData>({
    scheduleUpdates: [],
    ideasUpdates: [],
    habitsUpdates: []
  });
  
  useEffect(() => {
    const handleAiResponse = (event: CustomEvent) => {
      setActiveQuery(event.detail.query);
      
      // Update categories with data from AI response
      setCategoryData({
        scheduleUpdates: event.detail.scheduleUpdates || [],
        ideasUpdates: event.detail.ideasUpdates || [],
        habitsUpdates: event.detail.habitsUpdates || []
      });
    };

    window.addEventListener('ai-response', handleAiResponse as EventListener);
    
    return () => {
      window.removeEventListener('ai-response', handleAiResponse as EventListener);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 min-h-[600px]">
      <div className="h-full">
        <SchedulePanel 
          activeQuery={activeQuery} 
          updates={categoryData.scheduleUpdates} 
        />
      </div>
      <div className="h-full">
        <IdeasPanel 
          activeQuery={activeQuery} 
          updates={categoryData.ideasUpdates} 
        />
      </div>
      <div className="h-full">
        <HabitsPanel 
          activeQuery={activeQuery} 
          updates={categoryData.habitsUpdates} 
        />
      </div>
    </div>
  );
}