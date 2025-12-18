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
      analyzed_at: status === 'analyzed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    if (errorMessage) {
      updateData.metadata = { error: errorMessage };
    }

    // If marking as failed, increment retry_count
    if (status === 'failed') {
      // First get current retry_count
      const { data: currentData } = await supabase
        .from('screenshots')
        .select('retry_count')
        .eq('id', screenshotId)
        .single();
      
      updateData.retry_count = (currentData?.retry_count || 0) + 1;
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
 * Also fetches failed screenshots for retry (up to MAX_RETRIES)
 * @param {number} limit - Maximum number of screenshots to fetch
 * @returns {Promise<Array>} Array of pending screenshots
 */
async function getPendingScreenshots(limit = 10) {
  const MAX_RETRIES = 3; // Maximum retry attempts for failed screenshots
  
  try {
    const supabase = getClient();
    
    // Fetch pending screenshots
    const { data: pendingData, error: pendingError } = await supabase
      .from('screenshots')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (pendingError) {
      throw pendingError;
    }

    // Fetch failed screenshots for retry (only those with retry_count < MAX_RETRIES)
    // Also only retry screenshots that failed more than 1 minute ago (backoff)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: failedData, error: failedError } = await supabase
      .from('screenshots')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', MAX_RETRIES)
      .lt('updated_at', oneMinuteAgo)
      .order('created_at', { ascending: true })
      .limit(Math.max(0, limit - (pendingData?.length || 0)));

    if (failedError) {
      // Log but don't fail - pending screenshots are more important
      logger.warn('Error fetching failed screenshots for retry:', failedError);
    }

    const allScreenshots = [...(pendingData || []), ...(failedData || [])];
    
    const pendingCount = pendingData?.length || 0;
    const retryCount = failedData?.length || 0;
    if (pendingCount > 0 || retryCount > 0) {
      logger.info(`Fetched ${pendingCount} pending + ${retryCount} retry screenshots`);
    } else {
      logger.debug('No pending screenshots to process');
    }
    
    return allScreenshots;
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
