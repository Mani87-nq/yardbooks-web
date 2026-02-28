/**
 * GET /api/v1/user-settings — Get user display/preference settings
 * PUT /api/v1/user-settings — Update user display/preference settings
 *
 * Persists theme, language, currency, dateFormat, and displayPreferences
 * (JSON field for compactMode, etc.) to the UserSettings model.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { type Prisma } from '@prisma/client';
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

    // Read compactMode from the displayPreferences JSON field
    const prefs = (settings.displayPreferences ?? {}) as Record<string, unknown>;
    const compactMode = prefs.compactMode === true;

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

    // If compactMode is being updated, merge it into displayPreferences JSON
    let displayPreferences: Prisma.InputJsonValue | undefined;
    if (compactMode !== undefined) {
      const existing = await prisma.userSettings.findUnique({
        where: {
          userId_companyId: {
            userId: user!.sub,
            companyId: companyId!,
          },
        },
        select: { displayPreferences: true },
      });

      const currentPrefs = (existing?.displayPreferences ?? {}) as Record<string, boolean>;
      displayPreferences = { ...currentPrefs, compactMode } as Prisma.InputJsonValue;
    }

    // Upsert the UserSettings record
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
        ...(displayPreferences !== undefined ? { displayPreferences } : {}),
      },
      update: {
        ...prismaFields,
        ...(displayPreferences !== undefined ? { displayPreferences } : {}),
      },
    });

    const prefs = (settings.displayPreferences ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      theme: settings.theme,
      language: settings.language,
      currency: settings.currency,
      dateFormat: settings.dateFormat,
      compactMode: prefs.compactMode === true,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to save user settings');
  }
}
