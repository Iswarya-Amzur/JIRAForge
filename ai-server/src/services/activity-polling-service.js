/**
 * Activity Polling Service
 * Polls activity_records table for pending records and processes them.
 * Runs alongside the existing polling-service.js (old pipeline continues for old clients).
 *
 * Pattern: Same as polling-service.js — singleton class with start/stop/processing lock.
 */

const activityService = require('./activity-service');
const activityDbService = require('./db/activity-db-service');
const logger = require('../utils/logger');

class ActivityPollingService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    // Poll every 3 minutes by default (configurable via env)
    this.pollInterval = parseInt(process.env.ACTIVITY_POLLING_INTERVAL_MS || '180000', 10);
    this.batchSize = parseInt(process.env.ACTIVITY_POLLING_BATCH_SIZE || '20', 10);
    this.processing = false;
  }

  /**
   * Start the activity polling service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Activity polling service is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting activity polling service (interval: ${this.pollInterval}ms, batch size: ${this.batchSize})`);

    // Process immediately on start
    this.processPendingRecords().catch(error => {
      logger.error('Error in initial activity polling cycle:', error);
    });

    // Then set up interval
    this.intervalId = setInterval(() => {
      this.processPendingRecords().catch(error => {
        logger.error('Error in activity polling cycle:', error);
      });
    }, this.pollInterval);
  }

  /**
   * Stop the activity polling service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('Activity polling service stopped');
  }

  /**
   * Process pending activity records
   */
  async processPendingRecords() {
    // Skip if already processing (prevent overlapping runs)
    if (this.processing) {
      logger.debug('Previous activity polling cycle still running, skipping');
      return;
    }

    this.processing = true;

    try {
      // Reset records stuck in 'processing' for too long
      await activityDbService.resetStuckProcessingRecords(10);

      // Get pending records (only productive records that need AI analysis)
      const pendingRecords = await activityDbService.getPendingActivityBatches(this.batchSize);

      if (pendingRecords.length === 0) {
        logger.debug('No pending activity records to process');
        return;
      }

      logger.info(`Processing ${pendingRecords.length} pending activity record(s)`);

      // Group records by user_id for efficient batch processing
      const userBatches = {};
      for (const record of pendingRecords) {
        const key = record.user_id;
        if (!userBatches[key]) {
          userBatches[key] = [];
        }
        userBatches[key].push(record);
      }

      let successCount = 0;
      let failureCount = 0;

      // Per-batch timeout (default: 60 seconds)
      const batchTimeoutMs = parseInt(process.env.ACTIVITY_BATCH_TIMEOUT_MS || '60000', 10);

      // Process each user's batch
      for (const [userId, records] of Object.entries(userBatches)) {
        try {
          const recordIds = records.map(r => r.id);

          // Atomically claim records for processing
          const claimed = await activityDbService.claimBatchForProcessing(recordIds);
          if (claimed.length === 0) {
            logger.info('Activity records already claimed by another process, skipping');
            continue;
          }

          // Extract user's assigned issues from the records
          let userAssignedIssues = [];
          for (const record of records) {
            if (record.user_assigned_issues) {
              try {
                const parsed = typeof record.user_assigned_issues === 'string'
                  ? JSON.parse(record.user_assigned_issues)
                  : record.user_assigned_issues;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  userAssignedIssues = parsed;
                  break; // Use the first non-empty list
                }
              } catch (e) {
                // Ignore parse errors — try next record
              }
            }
          }

          // Analyze the batch with timeout
          const result = await Promise.race([
            activityService.analyzeBatch(
              records.map(r => ({
                id: r.id,
                window_title: r.window_title,
                application_name: r.application_name,
                ocr_text: r.ocr_text,
                total_time_seconds: r.total_time_seconds,
                start_time: r.start_time,
                end_time: r.end_time,
                classification: r.classification
              })),
              userAssignedIssues,
              userId,
              records[0]?.organization_id
            ),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Batch processing timed out after ${batchTimeoutMs / 1000}s`)), batchTimeoutMs)
            )
          ]);

          successCount += claimed.length;
          logger.info(`Batch for user ${userId}: ${claimed.length} records analyzed`);

        } catch (error) {
          failureCount += records.length;
          const recordIds = records.map(r => r.id);
          logger.error(`Error processing activity batch for user ${userId}:`, error);
          await activityDbService.markBatchFailed(recordIds, error.message);
        }
      }

      // Log completion
      const totalProcessed = successCount + failureCount;
      if (failureCount > 0) {
        logger.info(`Activity polling completed: ${totalProcessed} record(s) — ${successCount} succeeded, ${failureCount} failed`);
      } else if (successCount > 0) {
        logger.info(`Activity polling completed: ${totalProcessed} record(s) — all succeeded`);
      }

    } catch (error) {
      // Handle network errors gracefully
      const errorMessage = error?.message || '';
      const isNetworkError =
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('certificate') ||
        errorMessage.includes('fetch failed');

      if (isNetworkError) {
        logger.debug('Network error in activity polling (will retry on next cycle)');
      } else {
        logger.error('Error in activity polling cycle:', error);
      }
    } finally {
      this.processing = false;
    }
  }
}

// Create singleton instance
const activityPollingService = new ActivityPollingService();

module.exports = activityPollingService;
