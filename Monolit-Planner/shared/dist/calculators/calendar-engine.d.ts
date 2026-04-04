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
/**
 * Get all Czech public holidays for a given year.
 */
export declare function getCzechHolidays(year: number): Array<{
    date: Date;
    name: string;
}>;
/**
 * Check if a date is a working day.
 */
export declare function isWorkingDay(date: Date, config?: CalendarConfig): boolean;
/**
 * Add work days to a start date.
 * Returns the date after `workDays` working days.
 *
 * @param startDate - First day of work
 * @param workDays - Number of working days to add (can be fractional)
 * @param config - Calendar configuration
 */
export declare function addWorkDays(startDate: Date, workDays: number, config?: CalendarConfig): CalendarResult;
/**
 * Count work days between two dates (inclusive).
 */
export declare function countWorkDays(startDate: Date, endDate: Date, config?: CalendarConfig): number;
/**
 * Get summary for a specific month.
 */
export declare function getMonthSummary(year: number, month: number, config?: CalendarConfig): MonthSummary;
/**
 * Convert work-day duration to calendar-day duration.
 * Quick utility — no start date needed, uses average efficiency.
 *
 * @param workDays - Duration in work days
 * @param config - Calendar config (default Mon-Fri = 5/7 efficiency)
 * @returns Approximate calendar days
 */
export declare function workDaysToCalendarDays(workDays: number, config?: CalendarConfig): number;
/**
 * Convert calendar-day duration to work-day duration.
 * Quick utility — no dates needed, uses average efficiency.
 */
export declare function calendarDaysToWorkDays(calendarDays: number, config?: CalendarConfig): number;
