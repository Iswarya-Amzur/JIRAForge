/**
 * Date utilities for Time Analytics components
 */

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
    return workDate.toISOString().split('T')[0];
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
 * @param {Date} today - Reference date
 * @returns {Array<{dateStr: string, dayOfWeek: number, date: Date}>} Week dates
 */
export function getWeekDates(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const date = today.getDate();
  const todayStr = formatLocalDate(today);
  const startOfWeek = new Date(year, month, date - today.getDay());

  return Array.from({ length: 7 }, (_, i) => {
    const weekDate = new Date(year, month, startOfWeek.getDate() + i);
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
