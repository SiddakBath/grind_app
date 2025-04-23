'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createClientComponentClient, Session } from '@supabase/auth-helpers-nextjs';
import { SupabaseClient } from '@supabase/supabase-js';

// Define custom events for real-time updates
export const EVENTS = {
  SCHEDULE_UPDATED: 'schedule-updated',
  IDEAS_UPDATED: 'ideas-updated',
  HABITS_UPDATED: 'habits-updated'
};

interface SupabaseContext {
  supabase: SupabaseClient;
  session: Session | null;
}

const SupabaseContext = createContext<SupabaseContext | undefined>(undefined);

export default function SupabaseProvider({ 
  children,
  initialSession,
}: { 
  children: React.ReactNode;
  initialSession: Session | null;
}) {
  const [supabase] = useState(() => createClientComponentClient());
  const [session, setSession] = useState<Session | null>(initialSession);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Set up real-time subscriptions when user is authenticated
  useEffect(() => {
    if (!session?.user) return;
    
    // Create real-time subscriptions for each table
    const scheduleChannel = supabase
      .channel('schedule-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'schedule_items',
        filter: `user_id=eq.${session.user.id}`,
      }, () => {
        // Dispatch event to notify components of changes
        const event = new CustomEvent(EVENTS.SCHEDULE_UPDATED);
        window.dispatchEvent(event);
      })
      .subscribe();
      
    const ideasChannel = supabase
      .channel('ideas-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ideas',
        filter: `user_id=eq.${session.user.id}`,
      }, () => {
        // Dispatch event to notify components of changes
        const event = new CustomEvent(EVENTS.IDEAS_UPDATED);
        window.dispatchEvent(event);
      })
      .subscribe();
      
    const habitsChannel = supabase
      .channel('habits-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'habits',
        filter: `user_id=eq.${session.user.id}`,
      }, () => {
        // Dispatch event to notify components of changes
        const event = new CustomEvent(EVENTS.HABITS_UPDATED);
        window.dispatchEvent(event);
      })
      .subscribe();
    
    // Clean up subscriptions
    return () => {
      scheduleChannel.unsubscribe();
      ideasChannel.unsubscribe();
      habitsChannel.unsubscribe();
    };
  }, [supabase, session]);

  return (
    <SupabaseContext.Provider value={{ supabase, session }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used inside SupabaseProvider');
  }
  return context;
}; 