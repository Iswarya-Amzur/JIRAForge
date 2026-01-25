/**
 * Time formatting utility functions
 */

/**
 * Format seconds into a human-readable time string
 * Shows exact seconds for accuracy - individual times always add up to totals
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "2m 30s", "1h 15m")
 */
export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  // For durations >= 1 hour: show hours and minutes (seconds less relevant at this scale)
  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  // For durations < 1 hour: show minutes and seconds for accuracy
  if (minutes > 0) {
    if (secs > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${minutes}m`;
  }

  // Less than 1 minute: show seconds only
  return `${secs}s`;
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
