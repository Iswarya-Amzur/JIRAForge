/**
 * DateTime Utility Module
 * Provides local time formatting to match desktop app behavior
 *
 * IMPORTANT: This module generates timestamps in LOCAL TIME without timezone suffix
 * to match the Python desktop app's datetime.now().isoformat() format.
 * This ensures consistency between desktop app and AI server timestamps.
 */

/**
 * Get current local time as ISO string without timezone suffix
 * Matches Python's datetime.now().isoformat() format
 *
 * Example output: "2024-01-15T15:30:45.123"
 * (No 'Z' suffix or timezone offset)
 *
 * @returns {string} Local time ISO string
 */
function getLocalISOString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Convert a Date object to local ISO string without timezone suffix
 * @param {Date} date - Date object to convert
 * @returns {string} Local time ISO string
 */
function toLocalISOString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

module.exports = {
  getLocalISOString,
  toLocalISOString
};
