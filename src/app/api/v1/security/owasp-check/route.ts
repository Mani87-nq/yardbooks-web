/**
 * GET /api/v1/security/owasp-check
 * Run OWASP Top 10 compliance verification.
 * Requires 'audit:read' permission (ACCOUNTANT+ role).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';
import { runOwaspChecks, summarizeResults } from '@/lib/security/owasp-checker';

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requirePermission(request, 'audit:read');
    if (authError) return authError;

    const results = await runOwaspChecks();
    const report = summarizeResults(results);

    return NextResponse.json({
      ...report,
      checks: results,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to run OWASP checks');
  }
}
