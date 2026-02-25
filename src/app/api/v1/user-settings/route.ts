/**
 * GET /api/v1/user-settings — Get user display/preference settings
 * PUT /api/v1/user-settings — Update user display/preference settings
 *
 * Persists theme, language, currency, dateFormat to the UserSettings model.
 * Also stores compactMode via a JSONB preferences column (added dynamically).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    let settings = await prisma.userSettings.findUnique({
      where: {
        userId_companyId: {
          userId: user!.sub,
          companyId: companyId!,
        },
      },
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId: user!.sub,
          companyId: companyId!,
        },
      });
    }

    // Try to read the compactMode from a preferences JSON column
    let compactMode = false;
    try {
      const rows = await prisma.$queryRaw<Array<{ display_preferences: string | null }>>`
        SELECT display_preferences::text
        FROM "UserSettings"
        WHERE "userId" = ${user!.sub} AND "companyId" = ${companyId!}
      `;
      if (rows.length > 0 && rows[0].display_preferences) {
        const prefs = JSON.parse(rows[0].display_preferences);
        compactMode = prefs.compactMode ?? false;
      }
    } catch {
      // Column may not exist yet; fall back to default
    }

    return NextResponse.json({
      theme: settings.theme,
      language: settings.language,
      currency: settings.currency,
      dateFormat: settings.dateFormat,
      compactMode,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to load user settings');
  }
}

const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(1).max(50).optional(),
  currency: z.enum(['JMD', 'USD', 'GBP', 'EUR', 'CAD', 'TTD', 'BBD', 'BSD', 'KYD']).optional(),
  dateFormat: z.string().min(1).max(20).optional(),
  compactMode: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:read');
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { compactMode, ...prismaFields } = parsed.data;

    // Upsert the UserSettings record with the Prisma-modeled fields
    const settings = await prisma.userSettings.upsert({
      where: {
        userId_companyId: {
          userId: user!.sub,
          companyId: companyId!,
        },
      },
      create: {
        userId: user!.sub,
        companyId: companyId!,
        ...prismaFields,
      },
      update: prismaFields,
    });

    // Store compactMode in a JSONB display_preferences column
    if (compactMode !== undefined) {
      try {
        await prisma.$executeRaw`
          ALTER TABLE "UserSettings"
          ADD COLUMN IF NOT EXISTS display_preferences JSONB DEFAULT '{}'::jsonb
        `;
      } catch {
        // Column might already exist
      }

      try {
        // Read existing preferences, merge, and write back
        const rows = await prisma.$queryRaw<Array<{ display_preferences: string | null }>>`
          SELECT display_preferences::text
          FROM "UserSettings"
          WHERE "userId" = ${user!.sub} AND "companyId" = ${companyId!}
        `;
        const existing = rows.length > 0 && rows[0].display_preferences
          ? JSON.parse(rows[0].display_preferences)
          : {};
        const merged = JSON.stringify({ ...existing, compactMode });
        await prisma.$executeRaw`
          UPDATE "UserSettings"
          SET display_preferences = ${merged}::jsonb
          WHERE "userId" = ${user!.sub} AND "companyId" = ${companyId!}
        `;
      } catch {
        // If raw JSON storage fails, the main fields are still saved
      }
    }

    // Read back compactMode for the response
    let savedCompactMode = false;
    try {
      const rows = await prisma.$queryRaw<Array<{ display_preferences: string | null }>>`
        SELECT display_preferences::text
        FROM "UserSettings"
        WHERE "userId" = ${user!.sub} AND "companyId" = ${companyId!}
      `;
      if (rows.length > 0 && rows[0].display_preferences) {
        const prefs = JSON.parse(rows[0].display_preferences);
        savedCompactMode = prefs.compactMode ?? false;
      }
    } catch {
      // Fall back
    }

    return NextResponse.json({
      theme: settings.theme,
      language: settings.language,
      currency: settings.currency,
      dateFormat: settings.dateFormat,
      compactMode: savedCompactMode,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to save user settings');
  }
}
