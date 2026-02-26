/**
 * Jamaica Public Holidays
 *
 * Official holidays as declared by the Government of Jamaica.
 * Some holidays are fixed dates, others are moveable (Easter-based).
 *
 * When a holiday falls on a Sunday, the following Monday is typically observed.
 *
 * Sources:
 * - Jamaica (Public Holidays) Act
 * - Government of Jamaica official gazette
 */

export interface JamaicaHoliday {
  date: string;   // YYYY-MM-DD
  name: string;
  isFixed: boolean;
}

// ─── Fixed Holidays ────────────────────────────────────────────

const FIXED_HOLIDAYS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 5, day: 23, name: 'Labour Day' },
  { month: 8, day: 1, name: 'Emancipation Day' },
  { month: 8, day: 6, name: 'Independence Day' },
  { month: 10, day: 19, name: 'National Heroes Day' },  // Third Monday in October (simplified as Oct 19)
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 26, name: 'Boxing Day' },
];

// ─── Easter Calculation (Anonymous Gregorian algorithm) ────────

function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── National Heroes Day: Third Monday in October ──────────────

function getThirdMondayInOctober(year: number): Date {
  const oct1 = new Date(year, 9, 1); // October 1
  const dayOfWeek = oct1.getDay();
  const firstMonday = dayOfWeek <= 1 ? 1 + (1 - dayOfWeek) : 1 + (8 - dayOfWeek);
  return new Date(year, 9, firstMonday + 14); // Third Monday = first + 14
}

// ─── Generate Holidays for a Year ──────────────────────────────

export function getJamaicaHolidays(year: number): JamaicaHoliday[] {
  const holidays: JamaicaHoliday[] = [];

  // Fixed holidays
  for (const h of FIXED_HOLIDAYS) {
    if (h.name === 'National Heroes Day') {
      // Use calculated third Monday in October
      const heroesDay = getThirdMondayInOctober(year);
      holidays.push({
        date: formatDate(heroesDay),
        name: h.name,
        isFixed: false,
      });
    } else {
      holidays.push({
        date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
        name: h.name,
        isFixed: true,
      });
    }
  }

  // Easter-based moveable holidays
  const easterSunday = calculateEaster(year);

  // Ash Wednesday (46 days before Easter)
  const ashWednesday = addDays(easterSunday, -46);
  holidays.push({ date: formatDate(ashWednesday), name: 'Ash Wednesday', isFixed: false });

  // Good Friday (2 days before Easter)
  const goodFriday = addDays(easterSunday, -2);
  holidays.push({ date: formatDate(goodFriday), name: 'Good Friday', isFixed: false });

  // Easter Monday (1 day after Easter)
  const easterMonday = addDays(easterSunday, 1);
  holidays.push({ date: formatDate(easterMonday), name: 'Easter Monday', isFixed: false });

  // Sort by date
  holidays.sort((a, b) => a.date.localeCompare(b.date));

  return holidays;
}

// ─── Utility Functions ──────────────────────────────────────────

/**
 * Check if a given date is a Jamaica public holiday.
 */
export function isPublicHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getJamaicaHolidays(year);
  const dateStr = formatDate(date);
  return holidays.some(h => h.date === dateStr);
}

/**
 * Get the name of the holiday on a given date, or null if not a holiday.
 */
export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const holidays = getJamaicaHolidays(year);
  const dateStr = formatDate(date);
  return holidays.find(h => h.date === dateStr)?.name ?? null;
}

/**
 * Calculate working days between two dates (excludes weekends and public holidays).
 */
export function getWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Skip public holidays
      if (!isPublicHoliday(current)) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Get upcoming holidays from today (or a given date).
 */
export function getUpcomingHolidays(fromDate?: Date, limit: number = 5): JamaicaHoliday[] {
  const from = fromDate ?? new Date();
  const fromStr = formatDate(from);

  // Check current year and next year
  const year = from.getFullYear();
  const allHolidays = [
    ...getJamaicaHolidays(year),
    ...getJamaicaHolidays(year + 1),
  ];

  return allHolidays
    .filter(h => h.date >= fromStr)
    .slice(0, limit);
}
