/**
 * GET  /api/v1/company/integrations — Load integration settings for the active company
 * PATCH /api/v1/company/integrations — Update integration settings (partial merge)
 *
 * Stores settings in Company.integrationSettings (JSON field).
 * Shape: { wipay?: WiPaySettings, email?: EmailSettings, ai?: AISettings }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requireAuth, requireCompany } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';

// ─── Types ──────────────────────────────────────────────────────

interface WiPaySettings {
  accountNumber: string;
  apiKey: string;
  feeStructure: 'merchant' | 'customer';
  environment: 'sandbox' | 'live';
}

interface EmailSettings {
  fromAddress: string;
  configured: boolean;
}

interface AISettings {
  configured: boolean;
}

interface IntegrationSettings {
  wipay?: WiPaySettings;
  email?: EmailSettings;
  ai?: AISettings;
}

// ─── GET ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { integrationSettings: true, email: true },
    });

    if (!company) {
      return NextResponse.json({} as IntegrationSettings);
    }

    const stored = (company.integrationSettings as IntegrationSettings | null) ?? {};

    // Build response — merge stored settings with defaults
    const settings: IntegrationSettings = {
      wipay: stored.wipay ?? {
        accountNumber: '',
        apiKey: '',
        feeStructure: 'merchant',
        environment: 'sandbox',
      },
      email: stored.email ?? {
        fromAddress: company.email ?? '',
        configured: false,
      },
      ai: stored.ai ?? {
        configured: false,
      },
    };

    return NextResponse.json(settings);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to load integrations');
  }
}

// ─── PATCH ──────────────────────────────────────────────────────

const wipaySchema = z.object({
  accountNumber: z.string().max(100).optional(),
  apiKey: z.string().max(500).optional(),
  feeStructure: z.enum(['merchant', 'customer']).optional(),
  environment: z.enum(['sandbox', 'live']).optional(),
}).optional();

const emailSchema = z.object({
  fromAddress: z.string().email().max(200).optional(),
  configured: z.boolean().optional(),
}).optional();

const aiSchema = z.object({
  configured: z.boolean().optional(),
}).optional();

const patchSchema = z.object({
  wipay: wipaySchema,
  email: emailSchema,
  ai: aiSchema,
});

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    const { companyId, error: companyError } = requireCompany(user!);
    if (companyError) return companyError;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid integration settings');
    }

    // Load existing settings
    const company = await prisma.company.findUnique({
      where: { id: companyId! },
      select: { integrationSettings: true },
    });

    const existing = (company?.integrationSettings as IntegrationSettings | null) ?? {};

    // Deep merge incoming data with existing settings
    const updated: IntegrationSettings = { ...existing };

    if (parsed.data.wipay) {
      updated.wipay = {
        accountNumber: parsed.data.wipay.accountNumber ?? existing.wipay?.accountNumber ?? '',
        apiKey: parsed.data.wipay.apiKey ?? existing.wipay?.apiKey ?? '',
        feeStructure: parsed.data.wipay.feeStructure ?? existing.wipay?.feeStructure ?? 'merchant',
        environment: parsed.data.wipay.environment ?? existing.wipay?.environment ?? 'sandbox',
      };
    }

    if (parsed.data.email) {
      updated.email = {
        fromAddress: parsed.data.email.fromAddress ?? existing.email?.fromAddress ?? '',
        configured: parsed.data.email.configured ?? existing.email?.configured ?? false,
      };
    }

    if (parsed.data.ai) {
      updated.ai = {
        configured: parsed.data.ai.configured ?? existing.ai?.configured ?? false,
      };
    }

    // Save to database
    await prisma.company.update({
      where: { id: companyId! },
      data: { integrationSettings: updated as any },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update integrations');
  }
}
