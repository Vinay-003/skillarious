import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow public access to course details
  if (path.startsWith('/courses/') && !path.includes('/access/')) {
    return NextResponse.next();
  }

  // Protect these routes
  if (path.startsWith('/admin') || 
      path.startsWith('/dashboard') || 
      path.startsWith('/profile') || 
      path.startsWith('/educator') ||
      path.startsWith('/courses/access')) {
    const accessToken = request.cookies.get('accessToken');
    const refreshToken = request.cookies.get('refreshToken');

    if (!accessToken && !refreshToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/educator/:path*',
    '/courses/access/:path*',
    '/login',
    '/signup'
  ]
};
