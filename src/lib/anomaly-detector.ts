/**
 * Suspicious Activity Monitoring / Anomaly Detection Module
 *
 * Detects and records anomalous user behaviour such as:
 * - Bulk deletions (>5 in one minute)
 * - After-hours modifications (outside 08:00-18:00 Jamaica time, UTC-5)
 * - New device / IP logins
 * - Unusually large transactions (configurable multiplier of company average)
 * - Back-dated entries (>30 days by default)
 * - Rapid void / reverse sequences (>3 in 10 minutes)
 *
 * Alerts are persisted in AuditLog with action = SECURITY_ALERT.
 */

import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const AnomalyType = {
  BULK_DELETION: 'BULK_DELETION',
  AFTER_HOURS_MODIFICATION: 'AFTER_HOURS_MODIFICATION',
  NEW_DEVICE_LOGIN: 'NEW_DEVICE_LOGIN',
  LARGE_TRANSACTION: 'LARGE_TRANSACTION',
  BACKDATING: 'BACKDATING',
  RAPID_VOID_SEQUENCE: 'RAPID_VOID_SEQUENCE',
} as const;

export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];

export interface AnomalyAlert {
  type: AnomalyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId: string;
  companyId: string;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Configuration defaults
// ---------------------------------------------------------------------------

/** Jamaica Standard Time is UTC-5 year-round (no daylight saving). */
const JAMAICA_UTC_OFFSET_HOURS = -5;

const BUSINESS_HOUR_START = 8; // 08:00 local
const BUSINESS_HOUR_END = 18; // 18:00 local

const BULK_DELETION_THRESHOLD = 5;
const BULK_DELETION_WINDOW_MS = 60_000; // 1 minute

const RAPID_VOID_THRESHOLD = 3;
const RAPID_VOID_WINDOW_MS = 600_000; // 10 minutes

const DEFAULT_LARGE_TXN_MULTIPLIER = 10;
const DEFAULT_MAX_BACKDATE_DAYS = 30;

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

/**
 * Detect bulk deletions: >5 DELETE actions by the same user in the last minute.
 */
export async function detectBulkDeletion(
  userId: string,
  companyId: string,
): Promise<AnomalyAlert | null> {
  const windowStart = new Date(Date.now() - BULK_DELETION_WINDOW_MS);

  const count = await prisma.auditLog.count({
    where: {
      userId,
      companyId,
      action: 'DELETE',
      createdAt: { gte: windowStart },
    },
  });

  if (count > BULK_DELETION_THRESHOLD) {
    return {
      type: AnomalyType.BULK_DELETION,
      severity: 'HIGH',
      userId,
      companyId,
      description: `User performed ${count} deletions in the last minute (threshold: ${BULK_DELETION_THRESHOLD})`,
      metadata: { deletionCount: count, windowMs: BULK_DELETION_WINDOW_MS },
      timestamp: new Date(),
    };
  }

  return null;
}

/**
 * Detect after-hours activity: modifications outside 08:00-18:00 Jamaica time.
 */
export function detectAfterHoursActivity(
  companyId: string,
  timestamp?: Date,
): AnomalyAlert | null {
  const now = timestamp ?? new Date();

  // Convert to Jamaica local hour (UTC-5)
  const utcHour = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const jamaicaHour = ((utcHour + JAMAICA_UTC_OFFSET_HOURS) % 24 + 24) % 24;

  const isAfterHours =
    jamaicaHour < BUSINESS_HOUR_START || jamaicaHour >= BUSINESS_HOUR_END;

  if (isAfterHours) {
    const localTimeStr = `${String(jamaicaHour).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
    return {
      type: AnomalyType.AFTER_HOURS_MODIFICATION,
      severity: 'LOW',
      userId: '', // Caller should set this
      companyId,
      description: `Activity detected outside business hours at ${localTimeStr} Jamaica time`,
      metadata: {
        localHour: jamaicaHour,
        localTime: localTimeStr,
        businessHoursStart: BUSINESS_HOUR_START,
        businessHoursEnd: BUSINESS_HOUR_END,
        utcTimestamp: now.toISOString(),
      },
      timestamp: now,
    };
  }

  return null;
}

/**
 * Detect a new device or IP address login by comparing against existing sessions.
 */
export async function detectNewDevice(
  userId: string,
  userAgent: string,
  ipAddress: string,
): Promise<AnomalyAlert | null> {
  // Look for any previous session with the same user-agent AND IP
  const existingSession = await prisma.session.findFirst({
    where: {
      userId,
      userAgent,
      ipAddress,
    },
  });

  if (!existingSession) {
    // Check if the IP was ever used by this user (even with a different UA)
    const knownIp = await prisma.session.findFirst({
      where: { userId, ipAddress },
    });

    const severity = knownIp ? 'LOW' : 'MEDIUM';

    return {
      type: AnomalyType.NEW_DEVICE_LOGIN,
      severity,
      userId,
      companyId: '', // Caller should set this
      description: knownIp
        ? `Login from known IP but new device/browser`
        : `Login from new IP address and device`,
      metadata: {
        userAgent,
        ipAddress,
        knownIp: !!knownIp,
      },
      timestamp: new Date(),
    };
  }

  return null;
}

/**
 * Detect an unusually large transaction relative to the company's average.
 *
 * Compares `amount` to the average transaction value stored in recent invoices.
 * Uses a configurable multiplier (default 10x).
 */
export async function detectLargeTransaction(
  amount: number,
  companyId: string,
  thresholdMultiplier: number = DEFAULT_LARGE_TXN_MULTIPLIER,
): Promise<AnomalyAlert | null> {
  // Calculate average invoice total for the company over the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const aggregation = await prisma.invoice.aggregate({
    where: {
      companyId,
      createdAt: { gte: sixMonthsAgo },
    },
    _avg: { total: true },
    _count: true,
  });

  const avgTotal = aggregation._avg.total?.toNumber?.() ?? Number(aggregation._avg.total) ?? 0;
  const invoiceCount = aggregation._count;

  // If there are fewer than 5 invoices we cannot derive a reliable average.
  if (invoiceCount < 5 || avgTotal <= 0) return null;

  const threshold = avgTotal * thresholdMultiplier;

  if (amount > threshold) {
    return {
      type: AnomalyType.LARGE_TRANSACTION,
      severity: amount > threshold * 2 ? 'CRITICAL' : 'HIGH',
      userId: '', // Caller should set this
      companyId,
      description: `Transaction amount $${amount.toLocaleString()} exceeds ${thresholdMultiplier}x company average ($${avgTotal.toLocaleString()})`,
      metadata: {
        amount,
        companyAverage: avgTotal,
        threshold,
        multiplier: thresholdMultiplier,
        invoicesSampled: invoiceCount,
      },
      timestamp: new Date(),
    };
  }

  return null;
}

/**
 * Detect back-dating: an entry date more than `maxDaysBack` days in the past.
 */
export function detectBackdating(
  entryDate: Date,
  maxDaysBack: number = DEFAULT_MAX_BACKDATE_DAYS,
): AnomalyAlert | null {
  const now = new Date();
  const diffMs = now.getTime() - entryDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > maxDaysBack) {
    return {
      type: AnomalyType.BACKDATING,
      severity: diffDays > maxDaysBack * 2 ? 'HIGH' : 'MEDIUM',
      userId: '', // Caller should set this
      companyId: '', // Caller should set this
      description: `Entry back-dated by ${diffDays} days (max allowed: ${maxDaysBack})`,
      metadata: {
        entryDate: entryDate.toISOString(),
        daysBack: diffDays,
        maxDaysBack,
      },
      timestamp: now,
    };
  }

  return null;
}

/**
 * Detect rapid void/reverse sequences: >3 VOID actions by the same user in 10 minutes.
 */
export async function detectRapidVoidSequence(
  userId: string,
  companyId: string,
): Promise<AnomalyAlert | null> {
  const windowStart = new Date(Date.now() - RAPID_VOID_WINDOW_MS);

  const count = await prisma.auditLog.count({
    where: {
      userId,
      companyId,
      action: { in: ['VOID', 'REVERSE'] },
      createdAt: { gte: windowStart },
    },
  });

  if (count > RAPID_VOID_THRESHOLD) {
    return {
      type: AnomalyType.RAPID_VOID_SEQUENCE,
      severity: 'CRITICAL',
      userId,
      companyId,
      description: `User performed ${count} void/reverse actions in the last 10 minutes (threshold: ${RAPID_VOID_THRESHOLD})`,
      metadata: {
        voidCount: count,
        windowMs: RAPID_VOID_WINDOW_MS,
      },
      timestamp: new Date(),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Aggregate check
// ---------------------------------------------------------------------------

export interface AnomalyCheckParams {
  userId: string;
  companyId: string;
  action: string;
  entityType: string;
  amount?: number;
  entryDate?: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Run all relevant anomaly checks based on the provided context and return
 * an array of triggered alerts. Empty array means no anomalies detected.
 */
export async function checkAllAnomalies(
  params: AnomalyCheckParams,
): Promise<AnomalyAlert[]> {
  const {
    userId,
    companyId,
    action,
    entityType,
    amount,
    entryDate,
    userAgent,
    ipAddress,
  } = params;

  const alerts: AnomalyAlert[] = [];

  // 1. Bulk deletion check (only when the action is DELETE)
  if (action === 'DELETE') {
    const bulkAlert = await detectBulkDeletion(userId, companyId);
    if (bulkAlert) alerts.push(bulkAlert);
  }

  // 2. After-hours modification check (for write operations)
  const writeActions = new Set(['CREATE', 'UPDATE', 'DELETE', 'VOID', 'REVERSE', 'POST']);
  if (writeActions.has(action)) {
    const afterHoursAlert = detectAfterHoursActivity(companyId);
    if (afterHoursAlert) {
      afterHoursAlert.userId = userId;
      alerts.push(afterHoursAlert);
    }
  }

  // 3. New device/IP check (only for LOGIN)
  if (action === 'LOGIN' && userAgent && ipAddress) {
    const deviceAlert = await detectNewDevice(userId, userAgent, ipAddress);
    if (deviceAlert) {
      deviceAlert.companyId = companyId;
      alerts.push(deviceAlert);
    }
  }

  // 4. Large transaction check
  if (amount !== undefined && amount > 0) {
    const largeAlert = await detectLargeTransaction(amount, companyId);
    if (largeAlert) {
      largeAlert.userId = userId;
      alerts.push(largeAlert);
    }
  }

  // 5. Backdating check
  if (entryDate) {
    const backdateAlert = detectBackdating(entryDate);
    if (backdateAlert) {
      backdateAlert.userId = userId;
      backdateAlert.companyId = companyId;
      alerts.push(backdateAlert);
    }
  }

  // 6. Rapid void/reverse check
  if (action === 'VOID' || action === 'REVERSE') {
    const voidAlert = await detectRapidVoidSequence(userId, companyId);
    if (voidAlert) alerts.push(voidAlert);
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Record an anomaly alert into AuditLog with action = SECURITY_ALERT.
 * Non-blocking: errors are caught and logged in development.
 */
export async function recordAnomalyAlert(alert: AnomalyAlert): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: alert.companyId || undefined,
        userId: alert.userId || undefined,
        action: 'SECURITY_ALERT',
        entityType: 'SecurityAlert',
        entityId: `alert_${alert.type}_${alert.timestamp.getTime()}`,
        oldValues: Prisma.JsonNull,
        newValues: {
          type: alert.type,
          severity: alert.severity,
          description: alert.description,
          metadata: alert.metadata,
        } as unknown as Prisma.InputJsonValue,
        changedFields: [],
        notes: alert.description,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AnomalyDetector] Failed to record alert:', error);
    }
  }
}

/**
 * Convenience function: run all checks, record any alerts, and return them.
 */
export async function detectAndRecordAnomalies(
  params: AnomalyCheckParams,
): Promise<AnomalyAlert[]> {
  const alerts = await checkAllAnomalies(params);

  // Persist all triggered alerts in parallel
  await Promise.allSettled(alerts.map((a) => recordAnomalyAlert(a)));

  return alerts;
}
