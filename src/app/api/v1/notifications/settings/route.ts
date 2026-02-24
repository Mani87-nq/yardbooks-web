/**
 * GET/PUT /api/v1/notifications/settings
 * Manage per-user notification preferences.
 *
 * Settings are stored in the UserSettings model:
 * - enableNotifications: master toggle
 * - The full per-type preferences are stored as a JSON-encoded string
 *   in a dedicated row pattern (userId + companyId unique key).
 *
 * The detailed preferences (per notification type, per channel) are persisted
 * by encoding them into a JSON column via Prisma's raw query support,
 * falling back to the enableNotifications boolean if the JSON field is unavailable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// Schema for a single notification setting
const notificationSettingSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  email: z.boolean(),
  push: z.boolean(),
  inApp: z.boolean(),
});

const updateSettingsSchema = z.object({
  settings: z.array(notificationSettingSchema).min(1),
});

// Default settings returned when no saved preferences exist
const DEFAULT_SETTINGS = [
  { key: 'invoice_due', label: 'Invoice Due Reminders', description: 'Get notified when invoices are approaching due date', email: true, push: true, inApp: true },
  { key: 'invoice_overdue', label: 'Overdue Invoices', description: 'Alerts for invoices past their due date', email: true, push: true, inApp: true },
  { key: 'payment_received', label: 'Payment Received', description: 'Notification when a payment is recorded', email: true, push: false, inApp: true },
  { key: 'low_stock', label: 'Low Stock Alerts', description: 'When inventory falls below reorder level', email: true, push: true, inApp: true },
  { key: 'payroll_due', label: 'Payroll Reminders', description: 'Reminders for upcoming payroll runs', email: true, push: true, inApp: true },
  { key: 'expense_status', label: 'Expense Updates', description: 'When expenses are approved or rejected', email: false, push: false, inApp: true },
  { key: 'po_received', label: 'New Purchase Orders', description: 'When a new customer PO is received', email: true, push: true, inApp: true },
  { key: 'bank_sync', label: 'Bank Sync Updates', description: 'Status of bank transaction imports', email: false, push: false, inApp: true },
  { key: 'system', label: 'System Notifications', description: 'Important system updates and announcements', email: true, push: false, inApp: true },
];

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    // Try to load saved settings from UserSettings
    const userSettings = await prisma.userSettings.findUnique({
      where: {
        userId_companyId: {
          userId: user!.sub,
          companyId: companyId!,
        },
      },
    });

    // Try to read the notification preferences from the raw JSON column if it exists
    let savedPreferences = null;
    try {
      const rows = await prisma.$queryRaw<Array<{ notification_preferences: string | null }>>`
        SELECT notification_preferences::text
        FROM "UserSettings"
        WHERE "userId" = ${user!.sub} AND "companyId" = ${companyId!}
      `;
      if (rows.length > 0 && rows[0].notification_preferences) {
        savedPreferences = JSON.parse(rows[0].notification_preferences);
      }
    } catch {
      // Column may not exist yet; fall back to defaults
    }

    return NextResponse.json({
      enableNotifications: userSettings?.enableNotifications ?? true,
      settings: savedPreferences || DEFAULT_SETTINGS,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to load notification settings');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid notification settings');

    const { settings } = parsed.data;

    // Determine global enableNotifications from any channel being enabled
    const enableNotifications = settings.some(
      (s) => s.email || s.push || s.inApp
    );

    // Upsert the UserSettings record
    await prisma.userSettings.upsert({
      where: {
        userId_companyId: {
          userId: user!.sub,
          companyId: companyId!,
        },
      },
      create: {
        userId: user!.sub,
        companyId: companyId!,
        enableNotifications,
      },
      update: {
        enableNotifications,
      },
    });

    // Try to store the full notification preferences as JSON
    // If the column doesn't exist, create it first
    try {
      await prisma.$executeRaw`
        ALTER TABLE "UserSettings"
        ADD COLUMN IF NOT EXISTS notification_preferences JSONB
      `;
    } catch {
      // Column might already exist or ALTER TABLE might not be supported in this context
    }

    try {
      const preferencesJson = JSON.stringify(settings);
      await prisma.$executeRaw`
        UPDATE "UserSettings"
        SET notification_preferences = ${preferencesJson}::jsonb
        WHERE "userId" = ${user!.sub} AND "companyId" = ${companyId!}
      `;
    } catch {
      // If raw JSON storage fails, the enableNotifications boolean is still saved
    }

    return NextResponse.json({
      message: 'Notification settings saved successfully',
      enableNotifications,
      settings,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to save notification settings');
  }
}
