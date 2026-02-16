/**
 * Date utilities for Time Analytics components
 */

/**
 * Parse a UTC timestamp string from the database into a Date object.
 * Supabase timestamptz values arrive as e.g. "2026-02-11 07:30:23.360899+00"
 * which has a space separator and short "+00" offset — both non-standard for JS Date.
 * This normalizes to strict ISO 8601 before parsing.
 * @param {string} ts - Timestamp string from Supabase
 * @returns {Date|null} Parsed Date object or null if invalid
 */
export function parseUTC(ts) {
  if (!ts) return null;
  let s = String(ts).trim();
  // 1. Replace space with 'T' for ISO 8601 compliance
  s = s.replace(' ', 'T');
  // 2. Normalize short timezone offset: +00 → +00:00, -05 → -05:00
  s = s.replace(/([+-]\d{2})$/, '$1:00');
  // 3. If no timezone info at all, assume UTC
  if (!/[Zz]$/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s)) {
    s += 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize work_date to YYYY-MM-DD string
 * @param {string|Date|any} workDate - The work date to normalize
 * @returns {string} Normalized date string
 */
export function normalizeDate(workDate) {
  if (!workDate) return '';
  if (typeof workDate === 'string') {
    return workDate.split('T')[0];
  } else if (workDate instanceof Date) {
    return formatLocalDate(workDate);
  }
  return String(workDate).split('T')[0];
}

/**
 * Format date as YYYY-MM-DD in local time
 * @param {Date} d - Date object
 * @returns {string} Formatted date string
 */
export function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get today's date string in YYYY-MM-DD format
 * @returns {string} Today's date string
 */
export function getTodayStr() {
  const today = new Date();
  return formatLocalDate(today);
}

/**
 * Get week dates array up to today
 * Week starts on Monday (ISO week standard, consistent with Team Analytics)
 * @param {Date} today - Reference date
 * @returns {Array<{dateStr: string, dayOfWeek: number, date: Date}>} Week dates
 */
export function getWeekDates(today = new Date()) {
  const todayStr = formatLocalDate(today);

  // Calculate start of week (Monday) - ISO week standard
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  const startOfWeek = new Date(today);
  const dayOfWeek = startOfWeek.getDay();
  // If Sunday (0), go back 6 days. Otherwise, go back (dayOfWeek - 1) days.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(today.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    // Create each day by adding days to startOfWeek
    const weekDate = new Date(startOfWeek);
    weekDate.setDate(startOfWeek.getDate() + i);
    const dateStr = formatLocalDate(weekDate);
    return {
      dateStr,
      dayOfWeek: weekDate.getDay(),
      date: weekDate
    };
  }).filter(item => item.dateStr <= todayStr);
}

/**
 * Get current month string in YYYY-MM format
 * @param {Date} date - Reference date
 * @returns {string} Month string
 */
export function getMonthStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
