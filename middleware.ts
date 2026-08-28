import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Pages that should redirect to /dashboard if user is already logged in
const GUEST_ONLY = ['/login', '/register'];

// Pages accessible without authentication
const PUBLIC = ['/', '/privacy', '/terms'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow API routes and Next.js internals
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  // Authenticated user visiting landing page → dashboard
  // Note: /login and /register are NOT redirected here — they handle it client-side
  // via useSession to avoid redirect loops when a session cookie is stale/invalid.
  if (sessionCookie) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Unauthenticated user visiting protected pages → login
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p)) || GUEST_ONLY.some((p) => pathname.startsWith(p));
  if (!isPublic) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico|.*\\.webp).*)'],
};
