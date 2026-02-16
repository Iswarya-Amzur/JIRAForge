/**
 * DateTime Utility Module
 * Provides UTC timestamp formatting for consistent storage in Supabase.
 *
 * All timestamps are generated in UTC with ISO 8601 format (trailing 'Z').
 * The frontend converts to the user's local timezone for display via
 * new Date(timestamp).toLocaleString().
 */

/**
 * Get current time as a UTC ISO string.
 *
 * Example output: "2024-01-15T10:00:45.123Z"
 *
 * @returns {string} UTC ISO string
 */
function getUTCISOString() {
  return new Date().toISOString();
}

/**
 * Convert a Date object (or date string) to a UTC ISO string.
 * @param {Date|string} date - Date object or parseable date string
 * @returns {string} UTC ISO string
 */
function toUTCISOString(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString();
}

// Backwards-compatible aliases (deprecated — use getUTCISOString / toUTCISOString)
const getLocalISOString = getUTCISOString;
const toLocalISOString = toUTCISOString;

module.exports = {
  getUTCISOString,
  toUTCISOString,
  getLocalISOString,
  toLocalISOString
};
