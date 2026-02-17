/**
 * GET  /api/v1/exchange-rates — List exchange rates (filterable by currency, date range)
 * POST /api/v1/exchange-rates — Create or update an exchange rate
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth/middleware';
import { badRequest, internalError } from '@/lib/api-error';
import { Currency } from '@prisma/client';

// ---- GET (List) ----

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromCurrency = searchParams.get('from') as Currency | null;
    const toCurrency = searchParams.get('to') as Currency | null;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
    const cursor = searchParams.get('cursor') ?? undefined;

    const where: Record<string, unknown> = {};

    if (fromCurrency) {
      if (!Object.values(Currency).includes(fromCurrency)) {
        return badRequest(`Invalid currency code: ${fromCurrency}`);
      }
      where.fromCurrency = fromCurrency;
    }
    if (toCurrency) {
      if (!Object.values(Currency).includes(toCurrency)) {
        return badRequest(`Invalid currency code: ${toCurrency}`);
      }
      where.toCurrency = toCurrency;
    }
    if (dateFrom || dateTo) {
      const rateDate: Record<string, Date> = {};
      if (dateFrom) rateDate.gte = new Date(dateFrom);
      if (dateTo) rateDate.lte = new Date(dateTo);
      where.rateDate = rateDate;
    }

    const rates = await prisma.exchangeRate.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { rateDate: 'desc' },
    });

    const hasMore = rates.length > limit;
    const data = hasMore ? rates.slice(0, limit) : rates;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({
      data,
      pagination: { nextCursor, hasMore, limit },
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list exchange rates');
  }
}

// ---- POST (Create / Upsert) ----

const validCurrencies = Object.values(Currency) as [string, ...string[]];

const createRateSchema = z.object({
  fromCurrency: z.enum(validCurrencies),
  toCurrency: z.enum(validCurrencies).default('JMD'),
  rate: z.number().positive(),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  source: z.string().default('MANUAL'),
  isManualOverride: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requirePermission(request, 'settings:update');
    if (authError) return authError;

    const body = await request.json();
    const parsed = createRateSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
      return badRequest('Validation failed', fieldErrors);
    }

    const { fromCurrency, toCurrency, rate, rateDate, source, isManualOverride } = parsed.data;

    if (fromCurrency === toCurrency) {
      return badRequest('From and To currencies must be different');
    }

    const inverseRate = Math.round((1 / rate) * 1_000_000) / 1_000_000;
    const rateDateObj = new Date(rateDate);

    const exchangeRate = await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency_rateDate: {
          fromCurrency: fromCurrency as Currency,
          toCurrency: toCurrency as Currency,
          rateDate: rateDateObj,
        },
      },
      update: {
        rate,
        inverseRate,
        source,
        isManualOverride,
      },
      create: {
        fromCurrency: fromCurrency as Currency,
        toCurrency: toCurrency as Currency,
        rate,
        inverseRate,
        rateDate: rateDateObj,
        source,
        isManualOverride,
      },
    });

    return NextResponse.json(exchangeRate, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to create exchange rate');
  }
}
