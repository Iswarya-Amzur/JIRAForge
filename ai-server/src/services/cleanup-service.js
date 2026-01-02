/**
 * Cleanup Service
 * Deletes old screenshot files from Supabase Storage (PNG screenshots and JPG thumbnails)
 * Runs monthly to delete files older than 2 months
 * Database records are preserved for time tracking history
 */

const { getClient } = require('./db/supabase-client');
const { deleteFile } = require('./db/storage-service');
const logger = require('../utils/logger');
const { toLocalISOString } = require('../utils/datetime');

// Configuration (can be overridden via environment variables)
const CLEANUP_SCHEDULE_DAY = parseInt(process.env.CLEANUP_SCHEDULE_DAY || '1', 10); // 1st of month
const CLEANUP_SCHEDULE_HOUR = parseInt(process.env.CLEANUP_SCHEDULE_HOUR || '3', 10); // 3 AM
const CLEANUP_SCHEDULE_MINUTE = parseInt(process.env.CLEANUP_SCHEDULE_MINUTE || '0', 10); // 0 minutes
const MONTHS_TO_KEEP = parseInt(process.env.CLEANUP_MONTHS_TO_KEEP || '2', 10); // Keep last 2 months
const BATCH_SIZE = parseInt(process.env.CLEANUP_BATCH_SIZE || '50', 10); // Process 50 screenshots per batch

let scheduledTimeoutId = null;
let isRunning = false;

/**
 * Get the cutoff date for cleanup (files older than this will be deleted)
 * @returns {Date} Cutoff date
 */
function getCutoffDate() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS_TO_KEEP);
  cutoff.setDate(1); // First day of that month
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

/**
 * Get screenshots that need cleanup (files older than cutoff date)
 * @param {number} limit - Maximum number of screenshots to fetch
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Array of screenshots with storage_path
 */
async function getScreenshotsForCleanup(limit = BATCH_SIZE, offset = 0) {
  try {
    const supabase = getClient();
    const cutoffDate = getCutoffDate();
    const cutoffDateString = toLocalISOString(cutoffDate);

    logger.info(`[Cleanup] Fetching screenshots older than ${cutoffDate.toLocaleDateString()}`);

    // Get screenshots that:
    // 1. Have a storage_path (file exists)
    // 2. Are older than the cutoff date
    // 3. Haven't been marked as deleted yet (deleted_at is null, status is not 'deleted')
    const { data, error } = await supabase
      .from('screenshots')
      .select('id, storage_path, thumbnail_url, created_at')
      .lt('created_at', cutoffDateString)
      .not('storage_path', 'is', null)
      .is('deleted_at', null)
      .neq('status', 'deleted')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error('[Cleanup] Error fetching screenshots for cleanup:', error);
    throw error;
  }
}

/**
 * Get the thumbnail path from storage_path
 * Converts screenshot_xxx.png to thumb_xxx.jpg
 * @param {string} storagePath - Original screenshot storage path
 * @returns {string} Thumbnail storage path
 */
function getThumbnailPath(storagePath) {
  if (!storagePath) return null;

  if (storagePath.includes('/')) {
    const dirPath = storagePath.substring(0, storagePath.lastIndexOf('/'));
    const filename = storagePath.substring(storagePath.lastIndexOf('/') + 1);
    const thumbFilename = filename.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
    return `${dirPath}/${thumbFilename}`;
  } else {
    return storagePath.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
  }
}

/**
 * Delete a screenshot and its thumbnail from storage
 * @param {string} storagePath - Path to the screenshot file
 * @returns {Promise<{screenshotDeleted: boolean, thumbnailDeleted: boolean}>}
 */
async function deleteScreenshotFiles(storagePath) {
  const result = { screenshotDeleted: false, thumbnailDeleted: false };

  if (!storagePath) {
    return result;
  }

  // Delete the main screenshot
  try {
    await deleteFile('screenshots', storagePath);
    result.screenshotDeleted = true;
    logger.debug(`[Cleanup] Deleted screenshot: ${storagePath}`);
  } catch (error) {
    // File may already be deleted or not exist - log but don't fail
    logger.warn(`[Cleanup] Could not delete screenshot ${storagePath}: ${error.message}`);
  }

  // Delete the thumbnail
  const thumbPath = getThumbnailPath(storagePath);
  if (thumbPath) {
    try {
      await deleteFile('screenshots', thumbPath);
      result.thumbnailDeleted = true;
      logger.debug(`[Cleanup] Deleted thumbnail: ${thumbPath}`);
    } catch (error) {
      // Thumbnail may not exist - log but don't fail
      logger.warn(`[Cleanup] Could not delete thumbnail ${thumbPath}: ${error.message}`);
    }
  }

  return result;
}

/**
 * Mark screenshot as having files deleted in the database
 * Uses existing deleted_at column and sets status to 'deleted'
 * @param {string} screenshotId - Screenshot ID
 * @returns {Promise<void>}
 */
async function markFilesAsDeleted(screenshotId) {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('screenshots')
      .update({
        storage_url: null,
        thumbnail_url: null,
        status: 'deleted',
        deleted_at: toLocalISOString(new Date())
      })
      .eq('id', screenshotId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error(`[Cleanup] Error marking screenshot ${screenshotId} as deleted:`, error);
    throw error;
  }
}

/**
 * Main cleanup function - deletes old screenshot files from storage
 * @returns {Promise<{success: boolean, deleted: number, errors: number}>}
 */
async function runCleanup() {
  if (isRunning) {
    logger.warn('[Cleanup] Cleanup is already running, skipping');
    return { success: false, deleted: 0, errors: 0 };
  }

  isRunning = true;
  const startTime = Date.now();
  let totalDeleted = 0;
  let totalErrors = 0;

  try {
    const cutoffDate = getCutoffDate();
    logger.info(`[Cleanup] Starting monthly cleanup job - deleting files older than ${cutoffDate.toLocaleDateString()}`);

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const screenshots = await getScreenshotsForCleanup(BATCH_SIZE, offset);

      if (screenshots.length === 0) {
        hasMore = false;
        break;
      }

      logger.info(`[Cleanup] Processing batch of ${screenshots.length} screenshots (offset: ${offset})`);

      for (const screenshot of screenshots) {
        try {
          // Delete files from storage
          const deleteResult = await deleteScreenshotFiles(screenshot.storage_path);

          // Mark as deleted in database (even if file deletion failed - file may already be gone)
          await markFilesAsDeleted(screenshot.id);

          if (deleteResult.screenshotDeleted || deleteResult.thumbnailDeleted) {
            totalDeleted++;
          }
        } catch (error) {
          totalErrors++;
          logger.error(`[Cleanup] Error processing screenshot ${screenshot.id}:`, error);
          // Continue with next screenshot
        }
      }

      // If we got fewer than batch size, we're done
      if (screenshots.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        // Note: We don't increment offset because we're marking records as processed
        // The next query will skip already-processed records via files_deleted filter
      }

      // Small delay between batches to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`[Cleanup] Monthly cleanup completed in ${duration}s - ${totalDeleted} files deleted, ${totalErrors} errors`);

    return { success: true, deleted: totalDeleted, errors: totalErrors };
  } catch (error) {
    logger.error('[Cleanup] Error in cleanup job:', error);
    return { success: false, deleted: totalDeleted, errors: totalErrors };
  } finally {
    isRunning = false;
  }
}

/**
 * Calculate milliseconds until the next scheduled cleanup time
 * Runs on the 1st of each month at 3 AM
 * @returns {number} Milliseconds until next scheduled run
 */
function getMillisecondsUntilScheduledTime() {
  const now = new Date();
  const scheduledTime = new Date();

  // Set to the scheduled day, hour, and minute
  scheduledTime.setDate(CLEANUP_SCHEDULE_DAY);
  scheduledTime.setHours(CLEANUP_SCHEDULE_HOUR, CLEANUP_SCHEDULE_MINUTE, 0, 0);

  // If scheduled time has passed this month, schedule for next month
  if (scheduledTime <= now) {
    scheduledTime.setMonth(scheduledTime.getMonth() + 1);
  }

  return scheduledTime.getTime() - now.getTime();
}

/**
 * Schedule the next cleanup run
 */
function scheduleNextRun() {
  const msUntilNextRun = getMillisecondsUntilScheduledTime();
  const daysUntilNextRun = (msUntilNextRun / (1000 * 60 * 60 * 24)).toFixed(2);

  const nextRunTime = new Date(Date.now() + msUntilNextRun);
  logger.info(`[Cleanup] Next scheduled run at ${nextRunTime.toLocaleString()} (in ${daysUntilNextRun} days)`);

  scheduledTimeoutId = setTimeout(async () => {
    await runCleanup();
    scheduleNextRun(); // Schedule the next month's run
  }, msUntilNextRun);
}

/**
 * Start the cleanup service
 * Schedules monthly cleanup runs
 * @returns {Promise<void>}
 */
async function start() {
  logger.info('[Cleanup] Starting cleanup service...');
  logger.info(`[Cleanup] Scheduled: ${CLEANUP_SCHEDULE_DAY}${getOrdinalSuffix(CLEANUP_SCHEDULE_DAY)} of each month at ${CLEANUP_SCHEDULE_HOUR}:${CLEANUP_SCHEDULE_MINUTE.toString().padStart(2, '0')}`);
  logger.info(`[Cleanup] Files older than ${MONTHS_TO_KEEP} months will be deleted`);

  // Schedule the monthly run
  scheduleNextRun();

  logger.info('[Cleanup] Cleanup service started successfully');
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 * @param {number} n - Number
 * @returns {string} Ordinal suffix
 */
function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Stop the cleanup service
 */
function stop() {
  if (scheduledTimeoutId) {
    clearTimeout(scheduledTimeoutId);
    scheduledTimeoutId = null;
    logger.info('[Cleanup] Cleanup service stopped');
  }
}

/**
 * Check if cleanup is currently running
 * @returns {boolean}
 */
function isCleanupRunning() {
  return isRunning;
}

module.exports = {
  start,
  stop,
  runCleanup, // Exported for manual triggering
  isCleanupRunning,
  getCutoffDate, // Exported for testing
  getScreenshotsForCleanup // Exported for testing
};
