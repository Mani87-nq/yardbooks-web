/**
 * Audit Trail Logger
 * Logs all CREATE, UPDATE, DELETE operations with before/after values.
 * Designed for integration into API routes and middleware.
 *
 * Usage:
 *   import { auditLog } from '@/lib/audit-logger';
 *
 *   await auditLog({
 *     companyId,
 *     userId,
 *     action: 'CREATE',
 *     entityType: 'Invoice',
 *     entityId: invoice.id,
 *     entityLabel: invoice.invoiceNumber,
 *     after: invoice,
 *     request,
 *   });
 */

import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLogInput {
  companyId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  request?: Request; // For IP and UA extraction
}

/**
 * Write an audit log entry. Non-blocking — errors are silently caught
 * so audit logging never breaks the main operation.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    const { companyId, userId, userEmail, action, entityType, entityId, entityLabel, before, after, request } = input;

    // Compute changes (for UPDATE actions)
    let changes: Record<string, { from: unknown; to: unknown }> | null = null;
    if (action === 'UPDATE' && before && after) {
      changes = computeChanges(before, after);
      // Skip logging if nothing actually changed
      if (Object.keys(changes).length === 0) return;
    }

    // Extract request context
    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    if (request) {
      ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
                  request.headers.get('x-real-ip') ??
                  undefined;
      userAgent = request.headers.get('user-agent') ?? undefined;
    }

    // Sanitize sensitive fields before logging
    const sanitizedBefore = before ? sanitize(before) : null;
    const sanitizedAfter = after ? sanitize(after) : null;

    await prisma.auditLog.create({
      data: {
        companyId: companyId ?? undefined,
        userId: userId ?? undefined,
        action,
        entityType,
        entityId,
        oldValues: sanitizedBefore ? (sanitizedBefore as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValues: sanitizedAfter ? (sanitizedAfter as Prisma.InputJsonValue) : Prisma.JsonNull,
        changedFields: changes ? Object.keys(changes) : [],
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Audit logging should never throw — log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[AuditLog] Failed to write audit log:', error);
    }
  }
}

/**
 * Compute a diff between before and after objects.
 * Returns only fields that actually changed.
 */
function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    // Skip internal/audit fields
    if (['createdAt', 'updatedAt', 'deletedAt'].includes(key)) continue;

    const oldVal = before[key];
    const newVal = after[key];

    // Compare as JSON strings for deep equality
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { from: oldVal, to: newVal };
    }
  }

  return changes;
}

/**
 * Remove sensitive fields from logged data.
 */
const SENSITIVE_FIELDS = new Set([
  'passwordHash',
  'password',
  'refreshToken',
  'token',
  'secret',
  'apiKey',
  'bankAccountNumber',
]);

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitize(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
