import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Header } from '@/components/Header';
import { DashboardPanels } from '@/components/DashboardPanels';
import AgentChat from '@/app/components/AgentChat';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export default async function Home() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <Header />
      <div className="flex-1 container max-w-7xl mx-auto px-4 py-6 flex flex-col gap-10">
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">🎉 New Feature: Advanced AI Assistant</h3>
            <p className="text-blue-700 dark:text-blue-400 text-sm">
              We've upgraded our AI with a ReAct agent that can better understand your schedule, ideas, and habits. 
              This new AI assistant provides more natural conversations and smarter recommendations!
            </p>
          </div>
          <AgentChat />
        </div>
        <div className="flex-1">
          <DashboardPanels />
        </div>
      </div>
    </main>
  );
}