import prisma from '@/lib/db';
import { Currency } from '@prisma/client';

// Currency metadata
export const CURRENCY_INFO: Record<string, { name: string; symbol: string; decimalPlaces: number }> = {
  JMD: { name: 'Jamaican Dollar', symbol: 'J$', decimalPlaces: 2 },
  USD: { name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  GBP: { name: 'British Pound', symbol: '\u00a3', decimalPlaces: 2 },
  EUR: { name: 'Euro', symbol: '\u20ac', decimalPlaces: 2 },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$', decimalPlaces: 2 },
  TTD: { name: 'Trinidad Dollar', symbol: 'TT$', decimalPlaces: 2 },
  BBD: { name: 'Barbados Dollar', symbol: 'BBD$', decimalPlaces: 2 },
  BSD: { name: 'Bahamian Dollar', symbol: 'B$', decimalPlaces: 2 },
  KYD: { name: 'Cayman Dollar', symbol: 'CI$', decimalPlaces: 2 },
};

export async function getExchangeRate(fromCurrency: Currency, toCurrency: Currency, date?: Date): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;
  const rateDate = date ? new Date(date.toISOString().split('T')[0]) : new Date(new Date().toISOString().split('T')[0]);

  // Try exact date first, then most recent
  const rate = await prisma.exchangeRate.findFirst({
    where: { fromCurrency, toCurrency, rateDate: { lte: rateDate } },
    orderBy: { rateDate: 'desc' },
  });

  return rate ? Number(rate.rate) : null;
}

export function convertToJMD(amount: number, exchangeRate: number): number {
  return Math.round(amount * exchangeRate * 100) / 100;
}

export function convertFromJMD(amountJMD: number, exchangeRate: number): number {
  if (exchangeRate === 0) throw new Error('Exchange rate cannot be zero');
  return Math.round((amountJMD / exchangeRate) * 100) / 100;
}

export function calculateFxGainLoss(originalAmountForeign: number, originalRate: number, settledRate: number): { gainLoss: number; isGain: boolean } {
  const originalJMD = convertToJMD(originalAmountForeign, originalRate);
  const settledJMD = convertToJMD(originalAmountForeign, settledRate);
  const gainLoss = settledJMD - originalJMD;
  return { gainLoss: Math.round(gainLoss * 100) / 100, isGain: gainLoss > 0 };
}

export async function fetchAndStoreRate(fromCurrency: Currency, date?: Date): Promise<void> {
  // Placeholder for API integration - for now rates are entered manually
  // When Open Exchange Rates is integrated, this will fetch from their API
}
