/**
 * Data Retention & User Data Management Service
 *
 * Jamaica tax law (Tax Administration Jamaica Act) requires a minimum
 * 6-year retention period for financial records. We add a 1-year buffer
 * (7 years total) for safety.
 *
 * Jamaica Data Protection Act 2020 grants data subjects the right to
 * portability and erasure, balanced against statutory retention obligations.
 */
import prisma from '@/lib/db';

// ─── Retention periods (in years) ──────────────────────────────────

/** Retention periods in years */
export const RETENTION_PERIODS = {
  /** Invoices, expenses, journal entries - 7 years (1 year buffer over legal minimum) */
  FINANCIAL_RECORDS: 7,
  /** GCT returns, payroll returns, withholding tax */
  TAX_RECORDS: 7,
  /** Payroll runs, employee records */
  PAYROLL_RECORDS: 7,
  /** Audit trail */
  AUDIT_LOGS: 7,
  /** Session tokens - 3 months */
  SESSIONS: 0.25,
  /** Read notifications - 6 months */
  NOTIFICATIONS: 0.5,
} as const;

// ─── Helper ────────────────────────────────────────────────────────

/**
 * Compute a cutoff date by subtracting a retention period (in years) from now.
 */
function cutoffDate(retentionYears: number): Date {
  const now = new Date();
  const cutoff = new Date(now);
  // Handle fractional years by converting to months
  const totalMonths = Math.round(retentionYears * 12);
  cutoff.setMonth(cutoff.getMonth() - totalMonths);
  return cutoff;
}

// ─── Find expired records ──────────────────────────────────────────

/**
 * Find records eligible for archival/deletion based on retention periods.
 * Financial records are reported for informational purposes only -
 * they must never be automatically deleted.
 */
export async function findExpiredRecords(companyId: string): Promise<{
  expiredSessions: number;
  expiredNotifications: number;
  archivableRecords: { entityType: string; count: number; oldestDate: Date }[];
}> {
  const sessionCutoff = cutoffDate(RETENTION_PERIODS.SESSIONS);
  const notificationCutoff = cutoffDate(RETENTION_PERIODS.NOTIFICATIONS);
  const financialCutoff = cutoffDate(RETENTION_PERIODS.FINANCIAL_RECORDS);

  // Count expired sessions (> 3 months old)
  // Sessions are user-scoped, not company-scoped directly.
  // We find sessions belonging to users who are members of this company.
  const companyMembers = await prisma.companyMember.findMany({
    where: { companyId },
    select: { userId: true },
  });
  const memberUserIds = companyMembers.map((m) => m.userId);

  const expiredSessions = await prisma.session.count({
    where: {
      userId: { in: memberUserIds },
      OR: [
        { expiresAt: { lt: new Date() } },
        { createdAt: { lt: sessionCutoff } },
      ],
    },
  });

  // Count old read notifications (> 6 months old)
  const expiredNotifications = await prisma.notification.count({
    where: {
      companyId,
      isRead: true,
      createdAt: { lt: notificationCutoff },
    },
  });

  // Find financial records older than 7 years (informational only)
  const archivableRecords: { entityType: string; count: number; oldestDate: Date }[] = [];

  const invoiceResult = await prisma.invoice.aggregate({
    where: { companyId, createdAt: { lt: financialCutoff } },
    _count: { id: true },
    _min: { createdAt: true },
  });
  if (invoiceResult._count.id > 0) {
    archivableRecords.push({
      entityType: 'invoice',
      count: invoiceResult._count.id,
      oldestDate: invoiceResult._min.createdAt!,
    });
  }

  const expenseResult = await prisma.expense.aggregate({
    where: { companyId, createdAt: { lt: financialCutoff } },
    _count: { id: true },
    _min: { createdAt: true },
  });
  if (expenseResult._count.id > 0) {
    archivableRecords.push({
      entityType: 'expense',
      count: expenseResult._count.id,
      oldestDate: expenseResult._min.createdAt!,
    });
  }

  const journalResult = await prisma.journalEntry.aggregate({
    where: { companyId, createdAt: { lt: financialCutoff } },
    _count: { id: true },
    _min: { createdAt: true },
  });
  if (journalResult._count.id > 0) {
    archivableRecords.push({
      entityType: 'journalEntry',
      count: journalResult._count.id,
      oldestDate: journalResult._min.createdAt!,
    });
  }

  const payrollResult = await prisma.payrollRun.aggregate({
    where: { companyId, createdAt: { lt: financialCutoff } },
    _count: { id: true },
    _min: { createdAt: true },
  });
  if (payrollResult._count.id > 0) {
    archivableRecords.push({
      entityType: 'payrollRun',
      count: payrollResult._count.id,
      oldestDate: payrollResult._min.createdAt!,
    });
  }

  const auditResult = await prisma.auditLog.aggregate({
    where: { companyId, createdAt: { lt: financialCutoff } },
    _count: { id: true },
    _min: { createdAt: true },
  });
  if (auditResult._count.id > 0) {
    archivableRecords.push({
      entityType: 'auditLog',
      count: auditResult._count.id,
      oldestDate: auditResult._min.createdAt!,
    });
  }

  return {
    expiredSessions,
    expiredNotifications,
    archivableRecords,
  };
}

// ─── Cleanup expired non-financial data ────────────────────────────

/**
 * Clean up expired sessions and old notifications (non-financial data only).
 * Financial records are NEVER deleted automatically.
 */
export async function cleanupExpiredData(companyId: string): Promise<{
  sessionsDeleted: number;
  notificationsDeleted: number;
}> {
  const sessionCutoff = cutoffDate(RETENTION_PERIODS.SESSIONS);
  const notificationCutoff = cutoffDate(RETENTION_PERIODS.NOTIFICATIONS);

  // Find company member user IDs
  const companyMembers = await prisma.companyMember.findMany({
    where: { companyId },
    select: { userId: true },
  });
  const memberUserIds = companyMembers.map((m) => m.userId);

  // Delete sessions older than 3 months or already expired
  const sessionsResult = await prisma.session.deleteMany({
    where: {
      userId: { in: memberUserIds },
      OR: [
        { expiresAt: { lt: new Date() } },
        { createdAt: { lt: sessionCutoff } },
      ],
    },
  });

  // Delete read notifications older than 6 months
  const notificationsResult = await prisma.notification.deleteMany({
    where: {
      companyId,
      isRead: true,
      createdAt: { lt: notificationCutoff },
    },
  });

  return {
    sessionsDeleted: sessionsResult.count,
    notificationsDeleted: notificationsResult.count,
  };
}

// ─── Export user data (Data portability) ───────────────────────────

/**
 * Export all user data for data portability.
 * Compliant with Jamaica Data Protection Act 2020 and GDPR principles.
 *
 * Returns all data associated with a user, sanitized (no password hashes,
 * no 2FA secrets, no backup codes).
 */
export async function exportUserData(userId: string): Promise<{
  user: Record<string, unknown>;
  companies: unknown[];
  invoices: unknown[];
  expenses: unknown[];
  auditLogs: unknown[];
}> {
  // Fetch user profile (sanitized - no sensitive auth fields)
  const rawUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      companyMemberships: {
        include: {
          company: {
            select: {
              id: true,
              businessName: true,
              tradingName: true,
              businessType: true,
              trnNumber: true,
              gctNumber: true,
              phone: true,
              email: true,
              addressStreet: true,
              addressCity: true,
              addressParish: true,
              currency: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!rawUser) {
    return { user: {}, companies: [], invoices: [], expenses: [], auditLogs: [] };
  }

  // Sanitize user data - exclude password hash, 2FA secrets, backup codes
  const user: Record<string, unknown> = {
    id: rawUser.id,
    email: rawUser.email,
    emailVerified: rawUser.emailVerified,
    firstName: rawUser.firstName,
    lastName: rawUser.lastName,
    phone: rawUser.phone,
    role: rawUser.role,
    twoFactorEnabled: rawUser.twoFactorEnabled,
    isActive: rawUser.isActive,
    lastLoginAt: rawUser.lastLoginAt,
    createdAt: rawUser.createdAt,
    updatedAt: rawUser.updatedAt,
  };

  // Companies user belongs to
  const companies = rawUser.companyMemberships.map((m) => ({
    role: m.role,
    isDefault: m.isDefault,
    joinedAt: m.createdAt,
    company: m.company,
  }));

  // Get all company IDs the user belongs to
  const companyIds = rawUser.companyMemberships.map((m) => m.companyId);

  // Fetch invoices created by user across all their companies
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: { in: companyIds },
      createdBy: userId,
    },
    include: {
      items: true,
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch expenses created by user across all their companies
  const expenses = await prisma.expense.findMany({
    where: {
      companyId: { in: companyIds },
      createdBy: userId,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch audit logs for the user
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 1000, // Limit to last 1000 audit entries for export size
  });

  return {
    user,
    companies,
    invoices,
    expenses,
    auditLogs,
  };
}

// ─── Anonymize user account ────────────────────────────────────────

/**
 * Anonymize a user account while preserving financial records.
 *
 * Used for account deletion workflow. Per Jamaica tax law, financial
 * records must be retained for 6+ years even after the user requests
 * deletion. This function:
 *
 * 1. Replaces all PII with anonymized values
 * 2. Deactivates the account and revokes all sessions
 * 3. Preserves financial records (invoices, expenses, journal entries)
 *    with anonymized references to the former user
 */
export async function anonymizeUser(userId: string): Promise<void> {
  const anonymizedEmail = `deleted-${userId}@anonymized.yaadbooks.local`;
  const anonymizedName = 'Deleted User';
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Anonymize user profile
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        firstName: anonymizedName,
        lastName: '',
        phone: null,
        avatarUrl: null,
        passwordHash: null,
        pin: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
        passwordHistory: [],
        biometricEnabled: false,
        isActive: false,
        deletedAt: now,
        activeCompanyId: null,
      },
    });

    // 2. Revoke all active sessions
    await tx.session.deleteMany({
      where: { userId },
    });

    // 3. Remove company memberships (user can no longer access data)
    await tx.companyMember.deleteMany({
      where: { userId },
    });

    // 4. Create audit log entry for the anonymization
    // We use the first company the user belonged to for the audit entry,
    // or null if they had no company membership
    const membership = await tx.companyMember.findFirst({
      where: { userId },
      select: { companyId: true },
    });

    await tx.auditLog.create({
      data: {
        companyId: membership?.companyId ?? null,
        userId,
        action: 'DELETE',
        entityType: 'user',
        entityId: userId,
        changedFields: [
          'email',
          'firstName',
          'lastName',
          'phone',
          'avatarUrl',
          'passwordHash',
          'pin',
          'twoFactorSecret',
          'twoFactorBackupCodes',
          'passwordHistory',
        ],
        notes: 'User account anonymized per data deletion request. Financial records preserved per Jamaica tax law.',
      },
    });

    // Financial records (invoices, expenses, journal entries, payroll)
    // are intentionally NOT deleted or modified.
    // The createdBy field still references the user ID, but the user
    // profile now contains only anonymized data.
  });
}
