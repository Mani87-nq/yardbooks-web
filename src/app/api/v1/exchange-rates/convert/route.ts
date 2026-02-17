/**
 * GET /api/v1/exchange-rates/convert — Convert between currencies
 * Query params: from, to, amount, date (optional)
 * Returns converted amount and rate used.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Currency } from '@prisma/client';
import { getExchangeRate, convertToJMD, convertFromJMD, CURRENCY_INFO } from '@/lib/currency/converter';
import { badRequest, internalError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') as Currency | null;
    const to = searchParams.get('to') as Currency | null;
    const amountStr = searchParams.get('amount');
    const dateStr = searchParams.get('date');

    if (!from || !to || !amountStr) {
      return badRequest('Missing required query parameters: from, to, amount');
    }

    const validCurrencies = Object.values(Currency);
    if (!validCurrencies.includes(from)) {
      return badRequest(`Invalid source currency: ${from}`);
    }
    if (!validCurrencies.includes(to)) {
      return badRequest(`Invalid target currency: ${to}`);
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 0) {
      return badRequest('Amount must be a non-negative number');
    }

    const date = dateStr ? new Date(dateStr) : undefined;

    if (from === to) {
      return NextResponse.json({
        from,
        to,
        amount,
        convertedAmount: amount,
        rate: 1,
        rateDate: dateStr ?? new Date().toISOString().split('T')[0],
      });
    }

    // Strategy: convert via JMD as base currency
    // Case 1: from foreign -> JMD
    // Case 2: from JMD -> foreign
    // Case 3: from foreign -> another foreign (via JMD)

    let convertedAmount: number;
    let effectiveRate: number;

    if (to === 'JMD') {
      // Foreign -> JMD
      const rate = await getExchangeRate(from, 'JMD', date);
      if (rate === null) {
        return badRequest(`No exchange rate found for ${from} to JMD`);
      }
      convertedAmount = convertToJMD(amount, rate);
      effectiveRate = rate;
    } else if (from === 'JMD') {
      // JMD -> Foreign
      const rate = await getExchangeRate(to, 'JMD', date);
      if (rate === null) {
        return badRequest(`No exchange rate found for ${to} to JMD`);
      }
      convertedAmount = convertFromJMD(amount, rate);
      effectiveRate = Math.round((1 / rate) * 1_000_000) / 1_000_000;
    } else {
      // Foreign -> Foreign via JMD
      const rateFromJMD = await getExchangeRate(from, 'JMD', date);
      const rateToJMD = await getExchangeRate(to, 'JMD', date);
      if (rateFromJMD === null) {
        return badRequest(`No exchange rate found for ${from} to JMD`);
      }
      if (rateToJMD === null) {
        return badRequest(`No exchange rate found for ${to} to JMD`);
      }
      const jmdAmount = convertToJMD(amount, rateFromJMD);
      convertedAmount = convertFromJMD(jmdAmount, rateToJMD);
      effectiveRate = Math.round((rateFromJMD / rateToJMD) * 1_000_000) / 1_000_000;
    }

    return NextResponse.json({
      from,
      to,
      amount,
      convertedAmount,
      rate: effectiveRate,
      rateDate: dateStr ?? new Date().toISOString().split('T')[0],
      fromInfo: CURRENCY_INFO[from],
      toInfo: CURRENCY_INFO[to],
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to convert currency');
  }
}
