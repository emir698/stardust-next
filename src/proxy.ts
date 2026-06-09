import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Firebase Auth token cookie adı (client tarafında set edilecek)
const SESSION_COOKIE = 'stardust_session';

const PUBLIC_PATHS = ['/login'];
const APP_ROOT = '/dashboard';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isPublic && hasSession) {
    return NextResponse.redirect(new URL(APP_ROOT, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
