const screenshotService = require('./screenshot-service');
const supabaseService = require('./supabase-service');
const logger = require('../utils/logger');

class PollingService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    // Poll every 30 seconds by default (configurable via env)
    this.pollInterval = parseInt(process.env.POLLING_INTERVAL_MS || '30000', 10);
    this.batchSize = parseInt(process.env.POLLING_BATCH_SIZE || '10', 10);
    this.processing = false;
  }

  /**
   * Start the polling service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Polling service is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting polling service (interval: ${this.pollInterval}ms, batch size: ${this.batchSize})`);

    // Process immediately on start
    this.processPendingScreenshots();

    // Then set up interval
    this.intervalId = setInterval(() => {
      this.processPendingScreenshots();
    }, this.pollInterval);
  }

  /**
   * Stop the polling service
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

    logger.info('Polling service stopped');
  }

  /**
   * Process pending screenshots
   */
  async processPendingScreenshots() {
    // Skip if already processing (prevent overlapping runs)
    if (this.processing) {
      logger.debug('Previous polling cycle still running, skipping this cycle');
      return;
    }

    this.processing = true;

    try {
      // Fetch pending screenshots from Supabase
      const pendingScreenshots = await supabaseService.getPendingScreenshots(this.batchSize);

      if (pendingScreenshots.length === 0) {
        logger.debug('No pending screenshots to process');
        return;
      }

      logger.info(`Processing ${pendingScreenshots.length} pending screenshot(s)`);

      // Track processing results
      let successCount = 0;
      let failureCount = 0;

      // Process each screenshot
      for (const screenshot of pendingScreenshots) {
        try {
          await this.processScreenshot(screenshot);
          successCount++;
        } catch (error) {
          failureCount++;
          logger.error('Error processing screenshot', {
            screenshot_id: screenshot.id,
            error: error.message
          });

          // Update status to failed
          try {
            await supabaseService.updateScreenshotStatus(
              screenshot.id,
              'failed',
              error.message
            );
          } catch (updateError) {
            logger.error('Failed to update screenshot status to failed', {
              screenshot_id: screenshot.id,
              error: updateError.message
            });
          }
        }
      }

      // Log accurate completion count
      const totalProcessed = successCount + failureCount;
      if (failureCount > 0) {
        logger.info(`Completed processing ${totalProcessed} screenshot(s): ${successCount} succeeded, ${failureCount} failed`);
      } else {
        logger.info(`Completed processing ${totalProcessed} screenshot(s): all succeeded`);
      }

    } catch (error) {
      // Handle network errors gracefully - these are expected in corporate environments
      const errorMessage = error.message || '';
      const isNetworkError = 
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('certificate') ||
        errorMessage.includes('fetch failed');

      if (isNetworkError) {
        // Log network errors at debug level to reduce noise
        // These are expected in corporate networks with proxies/firewalls
        logger.debug('Network error in polling cycle (will retry on next cycle)', {
          error: errorMessage.substring(0, 100) // Truncate long error messages
        });
      } else {
        // Log other errors at error level
        logger.error('Error in polling cycle:', error);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single screenshot
   * @param {Object} screenshot - Screenshot record from database
   */
  async processScreenshot(screenshot) {
    const {
      id: screenshot_id,
      user_id,
      storage_url,
      storage_path,
      window_title,
      application_name,
      timestamp,
      user_assigned_issues
    } = screenshot;

    logger.info('Processing screenshot', {
      screenshot_id,
      user_id,
      application_name
    });

    // Update status to processing
    await supabaseService.updateScreenshotStatus(screenshot_id, 'processing');

    // Parse user_assigned_issues if it's a string
    let parsedAssignedIssues = user_assigned_issues;
    if (typeof parsedAssignedIssues === 'string') {
      try {
        parsedAssignedIssues = JSON.parse(parsedAssignedIssues);
      } catch (e) {
        logger.warn('Failed to parse user_assigned_issues', { screenshot_id });
        parsedAssignedIssues = [];
      }
    }

    // If no assigned issues in screenshot metadata, fetch from cache
    if (!parsedAssignedIssues || parsedAssignedIssues.length === 0) {
      const cachedIssues = await supabaseService.getUserCachedIssues(user_id);
      parsedAssignedIssues = cachedIssues.map(issue => ({
        key: issue.issue_key,
        summary: issue.summary,
        status: issue.status,
        projectKey: issue.project_key
      }));
    }

    // Download screenshot from Supabase Storage
    const imageBuffer = await supabaseService.downloadFile('screenshots', storage_path);

    // Analyze the screenshot using GPT-4 Vision
    const analysis = await screenshotService.analyzeActivity({
      imageBuffer,
      windowTitle: window_title,
      applicationName: application_name,
      timestamp,
      userId: user_id,
      userAssignedIssues: parsedAssignedIssues || []
    });

    // Save analysis results to Supabase
    await supabaseService.saveAnalysisResult({
      screenshot_id,
      user_id,
      time_spent_seconds: analysis.timeSpentSeconds,
      active_task_key: analysis.taskKey,
      active_project_key: analysis.projectKey,
      confidence_score: analysis.confidenceScore,
      extracted_text: analysis.metadata?.extractedText || '',
      detected_jira_keys: analysis.detectedJiraKeys,
      work_type: analysis.workType,
      ai_model_version: analysis.modelVersion,
      analysis_metadata: analysis.metadata
    });

    // Update screenshot status to analyzed
    await supabaseService.updateScreenshotStatus(screenshot_id, 'analyzed');

    // If configured, create worklog in Jira (only for office work)
    if (analysis.taskKey && analysis.workType === 'office' && process.env.AUTO_CREATE_WORKLOGS === 'true') {
      try {
        await screenshotService.createWorklog({
          userId: user_id,
          issueKey: analysis.taskKey,
          timeSpentSeconds: analysis.timeSpentSeconds,
          startedAt: timestamp
        });

        // Mark worklog as created
        await supabaseService.markWorklogCreated(screenshot_id, analysis.taskKey);
      } catch (worklogError) {
        logger.error('Failed to create worklog', {
          error: worklogError.message,
          screenshot_id
        });
        // Don't fail the entire analysis if worklog creation fails
      }
    }

    logger.info('Screenshot analysis completed', {
      screenshot_id,
      taskKey: analysis.taskKey,
      confidenceScore: analysis.confidenceScore,
      workType: analysis.workType
    });
  }
}

// Create singleton instance
const pollingService = new PollingService();

module.exports = pollingService;
