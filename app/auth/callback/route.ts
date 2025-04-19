import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    try {
      await supabase.auth.exchangeCodeForSession(code);
      
      // Get the user after exchanging code for session
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if profile exists, if not create it
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (!profile) {
          // Create profile if it doesn't exist
          await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
            });
        }
      }
    } catch (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(
        new URL(`/login?error=Could not authenticate`, request.url)
      );
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/', request.url));
} 