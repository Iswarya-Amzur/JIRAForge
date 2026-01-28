/**
 * Time and Date Formatting Utilities
 */

/**
 * Format duration in seconds to human-readable format
 * Shows exact seconds for accuracy - individual times always add up to totals
 */
export function formatDuration(seconds) {
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
}

/**
 * Format date for Jira worklog started field
 * Jira requires format: yyyy-MM-dd'T'HH:mm:ss.SSSZ
 * Using UTC time and formatting with +0000 instead of Z
 */
export function formatJiraDate(date = new Date()) {
  const d = new Date(date);

  // Use UTC components
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(d.getUTCMilliseconds()).padStart(3, '0');

  // Format: yyyy-MM-dd'T'HH:mm:ss.SSS+0000 (Jira prefers +0000 over Z)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+0000`;
}
