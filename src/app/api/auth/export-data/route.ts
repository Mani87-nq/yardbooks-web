/**
 * GET /api/auth/export-data
 *
 * Export all data for the authenticated user (data portability).
 * Compliant with Jamaica Data Protection Act 2020.
 *
 * Requires 'settings:read' permission (any authenticated user).
 * Users can only export their own data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/middleware';
import { internalError } from '@/lib/api-error';
import { exportUserData } from '@/lib/data-retention';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;

    const data = await exportUserData(user!.sub);

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      format: 'json',
      dataRetentionNotice:
        'Financial records are retained for a minimum of 7 years in compliance with Jamaica tax law. ' +
        'To request account deletion, contact support. Your personal information will be anonymized ' +
        'while financial records are preserved as required by law.',
      ...data,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to export user data');
  }
}
