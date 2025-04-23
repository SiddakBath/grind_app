'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/app/supabase-provider';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { supabase, session } = useSupabase();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push('/login');
      } else {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [supabase, router, session]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return <>{children}</>;
} 