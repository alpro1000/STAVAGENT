/**
 * Calendar Engine v1.0
 *
 * Converts between work days and calendar days, accounting for:
 *   - Working week (Mon-Fri default, configurable)
 *   - Czech public holidays (Czech Republic calendar)
 *   - Custom non-working days (site shutdowns, weather)
 *   - Overtime / Saturday work
 *
 * Key operations:
 *   1. workDaysToCalendarDays(workDays, startDate) → endDate + calendarDays
 *   2. calendarDaysToWorkDays(startDate, endDate) → workDays
 *   3. addWorkDays(startDate, workDays) → endDate
 *   4. getWorkingDaysInMonth(year, month) → count
 *
 * Integration with Planner:
 *   - Element Scheduler produces work-day durations
 *   - Calendar Engine maps to real dates for Gantt display
 *   - Curing is calendar-based (24/7), work is work-day-based
 *
 * Reference: Czech Labor Code (Zákoník práce, zákon č. 262/2006 Sb.)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Day of week: 0=Sunday, 1=Monday ... 6=Saturday (JS Date convention) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Calendar configuration */
export interface CalendarConfig {
  /** Working days of the week. Default: [1,2,3,4,5] (Mon-Fri) */
  working_days?: DayOfWeek[];
  /** Include Saturdays as half-days (counts as 0.5). Default: false */
  saturday_half_day?: boolean;
  /** Custom non-working dates (YYYY-MM-DD strings or Date objects) */
  custom_holidays?: (string | Date)[];
  /** Ignore Czech public holidays. Default: false */
  ignore_public_holidays?: boolean;
  /** Year for holiday calculation. Default: startDate year or current year. */
  year?: number;
}

/** Result of calendar computation */
export interface CalendarResult {
  /** Start date (first work day) */
  start_date: Date;
  /** End date (last work day) */
  end_date: Date;
  /** Number of work days */
  work_days: number;
  /** Number of calendar days (end - start + 1) */
  calendar_days: number;
  /** Efficiency: work_days / calendar_days */
  efficiency: number;
  /** Public holidays that fell in the range */
  holidays_in_range: string[];
  /** Custom holidays that fell in the range */
  custom_holidays_in_range: string[];
}

/** Monthly summary */
export interface MonthSummary {
  year: number;
  month: number;
  working_days: number;
  calendar_days: number;
  holidays: string[];
}

// ─── Czech Public Holidays ──────────────────────────────────────────────────

/**
 * Fixed Czech public holidays (zákon č. 245/2000 Sb.)
 * Returns [month, day] pairs (1-indexed months).
 */
const FIXED_HOLIDAYS: Array<[number, number, string]> = [
  [1, 1, 'Nový rok / Den obnovy samostatného českého státu'],
  [5, 1, 'Svátek práce'],
  [5, 8, 'Den vítězství'],
  [7, 5, 'Den slovanských věrozvěstů Cyrila a Metoděje'],
  [7, 6, 'Den upálení mistra Jana Husa'],
  [9, 28, 'Den české státnosti'],
  [10, 28, 'Den vzniku samostatného československého státu'],
  [11, 17, 'Den boje za svobodu a demokracii'],
  [12, 24, 'Štědrý den'],
  [12, 25, '1. svátek vánoční'],
  [12, 26, '2. svátek vánoční'],
];

/**
 * Calculate Easter Monday (movable holiday) using the Anonymous Gregorian algorithm.
 * Easter Monday = Easter Sunday + 1 day.
 */
function easterMonday(year: number): Date {
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
  // Easter Sunday → Easter Monday
  return new Date(year, month - 1, day + 1);
}

/**
 * Get Good Friday for a given year.
 * Good Friday = Easter Sunday - 2 days.
 * Czech public holiday since 2016.
 */
function goodFriday(year: number): Date {
  const em = easterMonday(year);
  return new Date(em.getFullYear(), em.getMonth(), em.getDate() - 3);
}

/**
 * Get all Czech public holidays for a given year.
 */
export function getCzechHolidays(year: number): Array<{ date: Date; name: string }> {
  const holidays: Array<{ date: Date; name: string }> = [];

  // Fixed holidays
  for (const [month, day, name] of FIXED_HOLIDAYS) {
    holidays.push({ date: new Date(year, month - 1, day), name });
  }

  // Movable holidays
  holidays.push({ date: goodFriday(year), name: 'Velký pátek' });
  holidays.push({ date: easterMonday(year), name: 'Velikonoční pondělí' });

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Check if a date is a working day.
 */
export function isWorkingDay(
  date: Date,
  config: CalendarConfig = {},
): boolean {
  const dow = date.getDay() as DayOfWeek;
  const workingDays = config.working_days ?? [1, 2, 3, 4, 5];

  // Check if it's a configured working day
  if (!workingDays.includes(dow)) {
    // Saturday half-day: still counts as working
    if (config.saturday_half_day && dow === 6) return true;
    return false;
  }

  // Check public holidays
  if (!config.ignore_public_holidays) {
    const year = config.year ?? date.getFullYear();
    const holidays = getCzechHolidays(year);
    if (holidays.some(h => isSameDay(h.date, date))) return false;
  }

  // Check custom holidays
  if (config.custom_holidays) {
    for (const ch of config.custom_holidays) {
      const chDate = typeof ch === 'string' ? parseDate(ch) : ch;
      if (isSameDay(chDate, date)) return false;
    }
  }

  return true;
}

/**
 * Add work days to a start date.
 * Returns the date after `workDays` working days.
 *
 * @param startDate - First day of work
 * @param workDays - Number of working days to add (can be fractional)
 * @param config - Calendar configuration
 */
export function addWorkDays(
  startDate: Date,
  workDays: number,
  config: CalendarConfig = {},
): CalendarResult {
  const start = normalizeDate(startDate);
  const holidaysInRange: string[] = [];
  const customInRange: string[] = [];
  const year = config.year ?? start.getFullYear();
  const allHolidays = config.ignore_public_holidays ? [] : getCzechHolidays(year);

  // If start date is not a working day, advance to first working day
  let current = new Date(start);
  while (!isWorkingDay(current, config)) {
    current = nextDay(current);
  }
  const actualStart = new Date(current);

  let remaining = Math.ceil(workDays); // Round up fractional days
  let counted = 0;

  while (counted < remaining) {
    if (isWorkingDay(current, config)) {
      counted++;
      if (counted < remaining) {
        current = nextDay(current);
      }
    } else {
      // Track which holidays fell in range
      const holiday = allHolidays.find(h => isSameDay(h.date, current));
      if (holiday) holidaysInRange.push(holiday.name);

      if (config.custom_holidays) {
        for (const ch of config.custom_holidays) {
          const chDate = typeof ch === 'string' ? parseDate(ch) : ch;
          if (isSameDay(chDate, current)) {
            customInRange.push(formatDate(current));
          }
        }
      }

      current = nextDay(current);
    }
  }

  const calendarDays = daysBetween(actualStart, current) + 1;

  return {
    start_date: actualStart,
    end_date: current,
    work_days: workDays,
    calendar_days: calendarDays,
    efficiency: roundTo(workDays / calendarDays, 3),
    holidays_in_range: holidaysInRange,
    custom_holidays_in_range: customInRange,
  };
}

/**
 * Count work days between two dates (inclusive).
 */
export function countWorkDays(
  startDate: Date,
  endDate: Date,
  config: CalendarConfig = {},
): number {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  let count = 0;
  const satHalf = config.saturday_half_day ?? false;
  let current = new Date(start);

  while (current <= end) {
    if (isWorkingDay(current, config)) {
      count += (satHalf && current.getDay() === 6) ? 0.5 : 1;
    }
    current = nextDay(current);
  }

  return count;
}

/**
 * Get summary for a specific month.
 */
export function getMonthSummary(
  year: number,
  month: number,
  config: CalendarConfig = {},
): MonthSummary {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Last day of month
  const calendarDays = end.getDate();
  const workDays = countWorkDays(start, end, { ...config, year });

  const holidays = config.ignore_public_holidays
    ? []
    : getCzechHolidays(year)
        .filter(h => h.date.getMonth() === month - 1)
        .map(h => `${h.date.getDate()}.${month}. ${h.name}`);

  return {
    year,
    month,
    working_days: workDays,
    calendar_days: calendarDays,
    holidays,
  };
}

/**
 * Convert work-day duration to calendar-day duration.
 * Quick utility — no start date needed, uses average efficiency.
 *
 * @param workDays - Duration in work days
 * @param config - Calendar config (default Mon-Fri = 5/7 efficiency)
 * @returns Approximate calendar days
 */
export function workDaysToCalendarDays(
  workDays: number,
  config: CalendarConfig = {},
): number {
  const workingDays = config.working_days ?? [1, 2, 3, 4, 5];
  const satHalf = config.saturday_half_day ? 0.5 : 0;
  const workDaysPerWeek = workingDays.length + satHalf;
  const ratio = 7 / workDaysPerWeek;
  // Add ~3% for holidays (13 Czech holidays / 365 days ≈ 3.6%)
  const holidayFactor = config.ignore_public_holidays ? 1.0 : 1.036;
  return Math.ceil(workDays * ratio * holidayFactor);
}

/**
 * Convert calendar-day duration to work-day duration.
 * Quick utility — no dates needed, uses average efficiency.
 */
export function calendarDaysToWorkDays(
  calendarDays: number,
  config: CalendarConfig = {},
): number {
  const workingDays = config.working_days ?? [1, 2, 3, 4, 5];
  const satHalf = config.saturday_half_day ? 0.5 : 0;
  const workDaysPerWeek = workingDays.length + satHalf;
  const ratio = workDaysPerWeek / 7;
  const holidayFactor = config.ignore_public_holidays ? 1.0 : 0.964;
  return roundTo(calendarDays * ratio * holidayFactor, 1);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function nextDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function daysBetween(a: Date, b: Date): number {
  const ms = normalizeDate(b).getTime() - normalizeDate(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
