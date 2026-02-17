/**
 * GET /api/v1/currencies — List all supported currencies with metadata
 * Public reference data — no auth required.
 */
import { NextResponse } from 'next/server';
import { CURRENCY_INFO } from '@/lib/currency/converter';

export async function GET() {
  const currencies = Object.entries(CURRENCY_INFO).map(([code, info]) => ({
    code,
    ...info,
  }));

  return NextResponse.json({ data: currencies });
}
