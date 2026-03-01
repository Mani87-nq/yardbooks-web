/**
 * TEMPORARY: Pure pass-through middleware for navigation debugging.
 * If client-side navigation works with this, middleware is the cause.
 * If it STILL doesn't work, middleware is innocent.
 */
import { NextResponse } from 'next/server';

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|ogg|mp3|wav|pdf|woff|woff2|ttf|eot)$).*)',
  ],
};
