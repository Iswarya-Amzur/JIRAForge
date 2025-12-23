/**
 * Time formatting utility functions
 */

/**
 * Format seconds into a human-readable time string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "2h 30m")
 */
export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Format seconds into hours with decimal
 * @param {number} seconds - Time in seconds
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted hours (e.g., "2.5")
 */
export const formatHours = (seconds, decimals = 1) => {
  if (!seconds || seconds < 0) return '0';
  return (seconds / 3600).toFixed(decimals);
};

/**
 * Format a date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format a time for display
 * @param {string|Date} date - Date/time to format
 * @returns {string} Formatted time string
 */
export const formatTimeOfDay = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};
