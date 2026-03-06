/**
 * Calendar Engine Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getCzechHolidays,
  isWorkingDay,
  addWorkDays,
  countWorkDays,
  getMonthSummary,
  workDaysToCalendarDays,
  calendarDaysToWorkDays,
} from './calendar-engine.js';

// ─── Czech Holidays ─────────────────────────────────────────────────────────

describe('Czech Holidays', () => {
  it('returns 13 holidays per year', () => {
    const holidays = getCzechHolidays(2026);
    expect(holidays.length).toBe(13); // 11 fixed + Good Friday + Easter Monday
  });

  it('includes New Year', () => {
    const holidays = getCzechHolidays(2026);
    const ny = holidays.find(h => h.name.includes('Nový rok'));
    expect(ny).toBeDefined();
    expect(ny!.date.getMonth()).toBe(0);
    expect(ny!.date.getDate()).toBe(1);
  });

  it('includes May Day', () => {
    const holidays = getCzechHolidays(2026);
    const may = holidays.find(h => h.name.includes('Svátek práce'));
    expect(may).toBeDefined();
    expect(may!.date.getMonth()).toBe(4);
    expect(may!.date.getDate()).toBe(1);
  });

  it('calculates Easter Monday correctly for 2026', () => {
    // Easter Sunday 2026 = April 5, Easter Monday = April 6
    const holidays = getCzechHolidays(2026);
    const em = holidays.find(h => h.name === 'Velikonoční pondělí');
    expect(em).toBeDefined();
    expect(em!.date.getMonth()).toBe(3); // April
    expect(em!.date.getDate()).toBe(6);
  });

  it('calculates Good Friday correctly for 2026', () => {
    // Good Friday 2026 = April 3
    const holidays = getCzechHolidays(2026);
    const gf = holidays.find(h => h.name === 'Velký pátek');
    expect(gf).toBeDefined();
    expect(gf!.date.getMonth()).toBe(3); // April
    expect(gf!.date.getDate()).toBe(3);
  });

  it('includes Christmas', () => {
    const holidays = getCzechHolidays(2026);
    const xmas = holidays.filter(h => h.date.getMonth() === 11);
    expect(xmas.length).toBe(3); // 24, 25, 26 Dec
  });

  it('holidays are sorted by date', () => {
    const holidays = getCzechHolidays(2026);
    for (let i = 1; i < holidays.length; i++) {
      expect(holidays[i].date.getTime()).toBeGreaterThanOrEqual(holidays[i - 1].date.getTime());
    }
  });
});

// ─── isWorkingDay ───────────────────────────────────────────────────────────

describe('isWorkingDay', () => {
  it('Monday is a working day', () => {
    // 2026-03-02 is Monday
    expect(isWorkingDay(new Date(2026, 2, 2))).toBe(true);
  });

  it('Saturday is not a working day by default', () => {
    // 2026-03-07 is Saturday
    expect(isWorkingDay(new Date(2026, 2, 7))).toBe(false);
  });

  it('Sunday is not a working day', () => {
    // 2026-03-08 is Sunday
    expect(isWorkingDay(new Date(2026, 2, 8))).toBe(false);
  });

  it('public holiday on weekday is not working', () => {
    // 2026-05-01 is Friday (Svátek práce)
    expect(isWorkingDay(new Date(2026, 4, 1))).toBe(false);
  });

  it('respects custom holidays', () => {
    // Make a random Monday non-working
    expect(isWorkingDay(new Date(2026, 2, 2), {
      custom_holidays: ['2026-03-02'],
    })).toBe(false);
  });

  it('saturday_half_day makes Saturday working', () => {
    expect(isWorkingDay(new Date(2026, 2, 7), {
      saturday_half_day: true,
    })).toBe(true);
  });

  it('ignores public holidays when configured', () => {
    // Jan 1 2026 is Thursday — normally a holiday, but with ignore=true → working
    expect(isWorkingDay(new Date(2026, 0, 1), {
      ignore_public_holidays: true,
    })).toBe(true);
    // May 1 2026 is Friday — normally a holiday, but with ignore=true → working
    expect(isWorkingDay(new Date(2026, 4, 1), {
      ignore_public_holidays: true,
    })).toBe(true);
    // Without ignore, both should be non-working
    expect(isWorkingDay(new Date(2026, 0, 1))).toBe(false);
    expect(isWorkingDay(new Date(2026, 4, 1))).toBe(false);
  });
});

// ─── addWorkDays ────────────────────────────────────────────────────────────

describe('addWorkDays', () => {
  it('adds 5 work days = 1 week', () => {
    // Start: Monday 2026-03-02
    const result = addWorkDays(new Date(2026, 2, 2), 5);
    expect(result.end_date.getDate()).toBe(6); // Friday
    expect(result.calendar_days).toBe(5);
    expect(result.work_days).toBe(5);
  });

  it('adds 6 work days = spans weekend', () => {
    // Start: Monday 2026-03-02, 6 work days → Mon next week
    const result = addWorkDays(new Date(2026, 2, 2), 6);
    expect(result.end_date.getDate()).toBe(9); // Next Monday
    expect(result.calendar_days).toBe(8); // 5 + weekend + 1
  });

  it('adds 10 work days = 2 weeks', () => {
    const result = addWorkDays(new Date(2026, 2, 2), 10);
    expect(result.end_date.getDate()).toBe(13); // Friday 2 weeks later
    expect(result.calendar_days).toBe(12);
  });

  it('skips weekends', () => {
    // Start: Thursday 2026-03-05, add 3 days → Mon (skip Sat+Sun)
    const result = addWorkDays(new Date(2026, 2, 5), 3);
    expect(result.end_date.getDay()).toBe(1); // Monday
    expect(result.end_date.getDate()).toBe(9);
  });

  it('skips public holidays', () => {
    // April 2026: Good Friday = April 3, Easter Monday = April 6
    // Start: Wed April 1, add 3 work days
    // Apr 1 (Wed) → Apr 2 (Thu) → Apr 7 (Tue) [skip Apr 3 GF, 4 Sat, 5 Sun, 6 EM]
    const result = addWorkDays(new Date(2026, 3, 1), 3);
    expect(result.end_date.getDate()).toBe(7); // Tuesday April 7
    expect(result.holidays_in_range.length).toBeGreaterThan(0);
  });

  it('advances past non-working start date', () => {
    // Start on Saturday → should advance to Monday
    const result = addWorkDays(new Date(2026, 2, 7), 1); // Saturday
    expect(result.start_date.getDay()).toBe(1); // Monday
    expect(result.end_date.getDay()).toBe(1); // Same Monday (1 day)
  });

  it('returns efficiency ratio', () => {
    const result = addWorkDays(new Date(2026, 2, 2), 20);
    expect(result.efficiency).toBeGreaterThan(0.5);
    expect(result.efficiency).toBeLessThanOrEqual(1);
  });
});

// ─── countWorkDays ──────────────────────────────────────────────────────────

describe('countWorkDays', () => {
  it('Mon-Fri = 5 work days', () => {
    const count = countWorkDays(new Date(2026, 2, 2), new Date(2026, 2, 6));
    expect(count).toBe(5);
  });

  it('Mon-Sun = 5 work days', () => {
    const count = countWorkDays(new Date(2026, 2, 2), new Date(2026, 2, 8));
    expect(count).toBe(5);
  });

  it('Full month March 2026', () => {
    const count = countWorkDays(new Date(2026, 2, 1), new Date(2026, 2, 31));
    expect(count).toBe(22); // March 2026: 22 working days
  });

  it('counts Saturday as 0.5 with config', () => {
    // Mon-Sat = 5 + 0.5 = 5.5
    const count = countWorkDays(
      new Date(2026, 2, 2),
      new Date(2026, 2, 7),
      { saturday_half_day: true },
    );
    expect(count).toBe(5.5);
  });
});

// ─── getMonthSummary ────────────────────────────────────────────────────────

describe('getMonthSummary', () => {
  it('returns correct data for March 2026', () => {
    const summary = getMonthSummary(2026, 3);
    expect(summary.year).toBe(2026);
    expect(summary.month).toBe(3);
    expect(summary.calendar_days).toBe(31);
    expect(summary.working_days).toBe(22);
    expect(summary.holidays).toHaveLength(0); // No holidays in March
  });

  it('returns holidays for May', () => {
    const summary = getMonthSummary(2026, 5);
    expect(summary.holidays.length).toBe(2); // May 1 + May 8
    expect(summary.working_days).toBeLessThan(summary.calendar_days);
  });

  it('December has 3 holidays (24,25,26)', () => {
    const summary = getMonthSummary(2026, 12);
    expect(summary.holidays.length).toBe(3);
  });
});

// ─── Quick conversions ──────────────────────────────────────────────────────

describe('workDaysToCalendarDays', () => {
  it('5 work days ≈ 7-8 calendar days', () => {
    const cal = workDaysToCalendarDays(5);
    expect(cal).toBeGreaterThanOrEqual(7);
    expect(cal).toBeLessThanOrEqual(8);
  });

  it('20 work days ≈ 28-30 calendar days', () => {
    const cal = workDaysToCalendarDays(20);
    expect(cal).toBeGreaterThanOrEqual(28);
    expect(cal).toBeLessThanOrEqual(30);
  });

  it('with Saturday half-day, fewer calendar days needed', () => {
    const normal = workDaysToCalendarDays(20);
    const withSat = workDaysToCalendarDays(20, { saturday_half_day: true });
    expect(withSat).toBeLessThanOrEqual(normal);
  });

  it('ignoring holidays reduces calendar days slightly', () => {
    const withH = workDaysToCalendarDays(100);
    const noH = workDaysToCalendarDays(100, { ignore_public_holidays: true });
    expect(noH).toBeLessThanOrEqual(withH);
  });
});

describe('calendarDaysToWorkDays', () => {
  it('7 calendar days ≈ 5 work days', () => {
    const wd = calendarDaysToWorkDays(7);
    expect(wd).toBeGreaterThanOrEqual(4.5);
    expect(wd).toBeLessThanOrEqual(5.5);
  });

  it('30 calendar days ≈ 20-21 work days', () => {
    const wd = calendarDaysToWorkDays(30);
    expect(wd).toBeGreaterThanOrEqual(19);
    expect(wd).toBeLessThanOrEqual(22);
  });

  it('round trip is approximately consistent', () => {
    const original = 15;
    const cal = workDaysToCalendarDays(original);
    const back = calendarDaysToWorkDays(cal);
    expect(Math.abs(back - original)).toBeLessThan(2);
  });
});
