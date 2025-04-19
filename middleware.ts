import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Create the Supabase middleware client
  const supabase = createMiddlewareClient({ req, res });
  
  // This updates the session if needed and sets the cookies properly
  await supabase.auth.getSession();
  
  // After refreshing the session, get it to check for redirects
  const { data: { session } } = await supabase.auth.getSession();

  // Auth protection routes
  if (!session && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (session && req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return res;
}

export const config = {
  // Include auth/callback in the matcher to ensure session is properly handled
  matcher: ['/', '/login', '/auth/callback'],
};