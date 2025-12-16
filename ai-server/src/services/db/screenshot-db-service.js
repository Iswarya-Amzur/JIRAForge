/**
 * Screenshot Database Service Module
 * Handles screenshot-related database operations
 */

const { getClient, isNetworkError } = require('./supabase-client');
const logger = require('../../utils/logger');

/**
 * Update screenshot status
 * @param {string} screenshotId - Screenshot ID
 * @param {string} status - New status ('pending', 'analyzing', 'analyzed', 'error')
 * @param {string|null} errorMessage - Error message if status is 'error'
 * @returns {Promise<void>}
 */
async function updateScreenshotStatus(screenshotId, status, errorMessage = null) {
  try {
    const supabase = getClient();
    const updateData = {
      status,
      analyzed_at: status === 'analyzed' ? new Date().toISOString() : null
    };

    if (errorMessage) {
      updateData.metadata = { error: errorMessage };
    }

    const { error } = await supabase
      .from('screenshots')
      .update(updateData)
      .eq('id', screenshotId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error updating screenshot status:', error);
    throw new Error(`Failed to update screenshot status: ${error.message}`);
  }
}

/**
 * Update screenshot with duration data for event-based tracking
 * @param {string} screenshotId - Screenshot ID
 * @param {Object} durationData - Duration data object
 * @param {number} durationData.duration_seconds - Duration in seconds
 * @param {string} durationData.start_time - Start time (ISO string)
 * @param {string} durationData.end_time - End time (ISO string, defaults to now if not provided)
 * @returns {Promise<void>}
 */
async function updateScreenshotDuration(screenshotId, { duration_seconds, start_time, end_time }) {
  try {
    const supabase = getClient();
    const updateData = {
      duration_seconds,
      start_time,
      end_time: end_time || new Date().toISOString()
    };

    const { error } = await supabase
      .from('screenshots')
      .update(updateData)
      .eq('id', screenshotId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error updating screenshot duration:', error);
    throw new Error(`Failed to update screenshot duration: ${error.message}`);
  }
}

/**
 * Fetch pending screenshots from Supabase
 * @param {number} limit - Maximum number of screenshots to fetch
 * @returns {Promise<Array>} Array of pending screenshots
 */
async function getPendingScreenshots(limit = 10) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('screenshots')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    logger.info(`Fetched ${data?.length || 0} pending screenshots`);
    return data || [];
  } catch (error) {
    // Network errors should be re-thrown for polling service to handle
    if (isNetworkError(error)) {
      throw error;
    }
    logger.error('Error fetching pending screenshots:', error);
    throw new Error(`Failed to fetch pending screenshots: ${error.message}`);
  }
}

/**
 * Get screenshot by ID
 * @param {string} screenshotId - Screenshot ID
 * @returns {Promise<Object|null>} Screenshot data or null if not found
 */
async function getScreenshotById(screenshotId) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('screenshots')
      .select('*')
      .eq('id', screenshotId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error fetching screenshot by ID:', error);
    throw new Error(`Failed to fetch screenshot: ${error.message}`);
  }
}

module.exports = {
  updateScreenshotStatus,
  updateScreenshotDuration,
  getPendingScreenshots,
  getScreenshotById
};
