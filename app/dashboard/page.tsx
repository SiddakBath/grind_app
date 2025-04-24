import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Header } from '@/components/Header';
import { DashboardPanels } from '@/components/DashboardPanels';
import AgentChat from '@/app/components/AgentChat';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <Header />
      <div className="flex-1 container max-w-[98%] mx-auto px-2 py-4 flex flex-col gap-6">
        <div className="w-full">
          <AgentChat className="w-full" />
        </div>
        <div className="flex-1">
          <DashboardPanels />
        </div>
      </div>
    </main>
  );
} 