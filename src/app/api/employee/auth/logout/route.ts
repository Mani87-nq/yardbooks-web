/**
 * POST /api/employee/auth/logout
 * Clear the terminal session cookie.
 * PUBLIC endpoint — always succeeds.
 */
import { NextResponse } from 'next/server';
import { TERMINAL_TOKEN_COOKIE } from '@/lib/auth/terminal-jwt';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(TERMINAL_TOKEN_COOKIE);
  return response;
}
