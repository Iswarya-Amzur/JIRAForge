/**
 * Screenshot Database Service Module
 * Handles screenshot-related database operations
 */

const { getClient, isNetworkError } = require('./supabase-client');
const logger = require('../../utils/logger');
const { getLocalISOString, toLocalISOString } = require('../../utils/datetime');

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
      analyzed_at: status === 'analyzed' ? getLocalISOString() : null,
      updated_at: getLocalISOString()
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
      end_time: end_time || getLocalISOString()
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
    const oneMinuteAgo = toLocalISOString(new Date(Date.now() - 60 * 1000));
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
 * Clear storage URLs after files have been deleted
 * This prevents broken image links in the UI
 * @param {string} screenshotId - Screenshot ID
 * @returns {Promise<void>}
 */
async function clearStorageUrls(screenshotId) {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('screenshots')
      .update({
        storage_url: '',
        thumbnail_url: '',
        storage_path: '',
        updated_at: getLocalISOString()
      })
      .eq('id', screenshotId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error clearing storage URLs:', error);
    throw new Error(`Failed to clear storage URLs: ${error.message}`);
  }
}

/**
 * Atomically claim a screenshot for processing
 * Uses conditional update to prevent race conditions between webhook and polling
 * @param {string} screenshotId - Screenshot ID
 * @returns {Promise<boolean>} True if this caller won the claim (status was 'pending'), false otherwise
 */
async function claimScreenshotForProcessing(screenshotId) {
  try {
    const supabase = getClient();

    // Atomic: only update if status is 'pending' or 'failed' (retry-eligible)
    // If another process already claimed it, this returns no rows
    const { data, error } = await supabase
      .from('screenshots')
      .update({
        status: 'processing',
        updated_at: getLocalISOString()
      })
      .eq('id', screenshotId)
      .in('status', ['pending', 'failed'])
      .select('id');

    if (error) {
      throw error;
    }

    // If data array is empty, another process already claimed this screenshot
    const claimed = data && data.length > 0;
    if (!claimed) {
      logger.info('Screenshot already claimed or not pending', { screenshotId });
    }
    return claimed;
  } catch (error) {
    logger.error('Error claiming screenshot for processing:', error);
    throw new Error(`Failed to claim screenshot: ${error.message}`);
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
  getScreenshotById,
  clearStorageUrls,
  claimScreenshotForProcessing
};
