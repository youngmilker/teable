import { MS_PER_DAY, INITIAL_PAST_DAYS } from './constants';

/**
 * Convert any date string to local YYYY-MM-DD.
 * Unlike `.slice(0,10)` which returns the UTC date portion of an ISO string,
 * this parses through `new Date()` and extracts the local calendar date.
 * e.g. "2026-06-09T16:00:00.000Z" in UTC+8 → "2026-06-10"
 */
export const toLocalDate = (s: string): string => {
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Add `days` to an ISO date string (local midnight), return YYYY-MM-DD */
export const shiftIso = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Get local midnight timestamp for a Date object */
export const toMidnightMs = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Convert an ISO date string to a pixel offset relative to the epoch date */
export const dateToPixelOffset = (isoStr: string, epoch0Ms: number, dayWidth: number): number => {
  const d = new Date(isoStr);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((midnight - epoch0Ms) / MS_PER_DAY) * dayWidth;
};

/** Generate a date range centered around today */
export const generateDateRange = (pastDays = INITIAL_PAST_DAYS, futureDays = INITIAL_PAST_DAYS): Date[] => {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = -pastDays; i < futureDays; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }
  return dates;
};
