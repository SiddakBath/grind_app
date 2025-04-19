import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Header } from '@/components/Header';
import { AiChat } from '@/components/AiChat';
import { DashboardPanels } from '@/components/DashboardPanels';

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
        <AiChat className="mb-2" />
        <div className="flex-1">
          <DashboardPanels />
        </div>
      </div>
    </main>
  );
}