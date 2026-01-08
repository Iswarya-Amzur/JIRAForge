const screenshotService = require('../services/screenshot-service');
const supabaseService = require('../services/supabase-service');
const logger = require('../utils/logger');
const { getLocalISOString, toLocalISOString } = require('../utils/datetime');

/**
 * Analyze screenshot endpoint
 * Triggered by Supabase webhook when a new screenshot is uploaded
 */
exports.analyzeScreenshot = async (req, res) => {
  try {
    // Supabase webhooks send data in req.body.record
    const webhookData = req.body.record || req.body;

    const {
      id,
      screenshot_id: screenshotIdFromPayload,  // Backwards compatibility: legacy payloads may use 'screenshot_id'
      user_id,
      organization_id,  // Multi-tenancy: Extract organization_id from webhook payload
      storage_url,
      storage_path,
      window_title,
      application_name,
      timestamp,
      duration_seconds,  // Event-based tracking: Duration set by desktop app
      start_time,        // Event-based tracking: Start time set by desktop app
      end_time,          // Event-based tracking: End time set by desktop app
      user_assigned_issues // Optional: User's assigned Jira issues from Forge app
    } = webhookData;

    // Edge Function sends 'id' (spreads full record), fallback to 'screenshot_id' for backwards compatibility
    const screenshot_id = id || screenshotIdFromPayload;

    // Parse user_assigned_issues if it's a string (defensive coding)
    let parsedAssignedIssues = user_assigned_issues;
    if (typeof parsedAssignedIssues === 'string') {
      try {
        parsedAssignedIssues = JSON.parse(parsedAssignedIssues);
      } catch (e) {
        logger.warn('Failed to parse user_assigned_issues string', { user_assigned_issues });
        parsedAssignedIssues = [];
      }
    }

    // Validate required fields
    if (!screenshot_id || !user_id || !storage_url) {
      logger.error('Missing required fields in webhook payload', { body: req.body });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: screenshot_id (id), user_id, storage_url'
      });
    }

    // If organization_id is missing (Edge Function doesn't send it), fetch from screenshot record
    let resolvedOrganizationId = organization_id;
    if (!resolvedOrganizationId) {
      const screenshotRecord = await supabaseService.getScreenshotById(screenshot_id);
      if (screenshotRecord) {
        resolvedOrganizationId = screenshotRecord.organization_id;
        logger.info('Fetched organization_id from screenshot record', {
          screenshot_id,
          organization_id: resolvedOrganizationId
        });
      }
    }

    logger.info('Starting screenshot analysis', {
      screenshot_id,
      user_id,
      organization_id: resolvedOrganizationId,
      application_name,
      hasAssignedIssues: !!parsedAssignedIssues && parsedAssignedIssues.length > 0
    });

    // Download screenshot from Supabase Storage
    const imageBuffer = await supabaseService.downloadFile('screenshots', storage_path);

    // Analyze the screenshot using GPT-4 Vision
    // This will automatically fall back to OCR + AI if Vision fails
    // Pass user's assigned issues if provided (from webhook payload)
    const analysis = await screenshotService.analyzeActivity({
      imageBuffer, // Pass image buffer directly for Vision analysis
      windowTitle: window_title,
      applicationName: application_name,
      timestamp,
      userId: user_id,
      userAssignedIssues: parsedAssignedIssues || [], // Pass assigned issues to analysis
      organizationId: resolvedOrganizationId, // Pass organization ID for cost tracking
      screenshotId: screenshot_id // Pass screenshot ID for cost tracking
    });

    // Use actual duration from desktop app if available, otherwise use AI's calculated value
    // Desktop app sets duration_seconds based on actual window tracking (event-based)
    // IMPORTANT: Use ?? (nullish coalescing) instead of || to handle duration_seconds: 0 correctly
    // The || operator treats 0 as falsy, which would incorrectly fall back to 300
    const actualDuration = duration_seconds ?? analysis.timeSpentSeconds;

    // Save analysis results to Supabase - include organization_id for multi-tenancy
    await supabaseService.saveAnalysisResult({
      screenshot_id,
      user_id,
      organization_id: resolvedOrganizationId,  // Multi-tenancy: Use resolved organization_id
      time_spent_seconds: actualDuration,
      active_task_key: analysis.taskKey,
      active_project_key: analysis.projectKey,
      confidence_score: analysis.confidenceScore,
      extracted_text: analysis.metadata?.extractedText || '', // OCR text if fallback was used
      work_type: analysis.workType, // 'office' or 'non-office'
      ai_model_version: analysis.modelVersion,
      analysis_metadata: analysis.metadata
    });

    // Update screenshot with duration data for event-based tracking
    // IMPORTANT: Only update if desktop app hasn't already set the values
    // Desktop app's event-based tracking provides accurate duration based on actual window switches
    // NOTE: Use "== null" to check for null/undefined, NOT "!" which treats 0 as falsy
    // Duration of 0 is a valid value set by desktop app (will be updated later with actual duration)
    if (duration_seconds == null || !start_time || !end_time) {
      // Fallback: Calculate duration for legacy screenshots that don't have event-based data
      const calculatedEndTime = timestamp || getLocalISOString();
      const calculatedStartTime = toLocalISOString(new Date(new Date(calculatedEndTime).getTime() - (actualDuration * 1000)));

      await supabaseService.updateScreenshotDuration(screenshot_id, {
        duration_seconds: duration_seconds != null ? duration_seconds : actualDuration,
        start_time: start_time || calculatedStartTime,  // Use desktop app's value if available
        end_time: end_time || calculatedEndTime         // Use desktop app's value if available
      });
    }
    // If desktop app already set all duration fields, no need to update - they're already accurate

    // Update screenshot status
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
        logger.error('Failed to create worklog', { error: worklogError, screenshot_id });
        // Don't fail the entire analysis if worklog creation fails
      }
    }

    logger.info('Screenshot analysis completed', {
      screenshot_id,
      taskKey: analysis.taskKey,
      confidenceScore: analysis.confidenceScore
    });

    res.json({
      success: true,
      screenshot_id,
      analysis: {
        task_key: analysis.taskKey,
        project_key: analysis.projectKey,
        confidence_score: analysis.confidenceScore,
        work_type: analysis.workType // 'office' or 'non-office'
      }
    });

  } catch (error) {
    logger.error('Screenshot analysis error:', error);

    // Update screenshot status to failed
    // Support both 'id' and 'screenshot_id' from various payload formats
    const failedScreenshotId = req.body.record?.id || req.body.id || req.body.screenshot_id;
    if (failedScreenshotId) {
      try {
        await supabaseService.updateScreenshotStatus(
          failedScreenshotId,
          'failed',
          error.message
        );
      } catch (updateError) {
        logger.error('Failed to update screenshot status:', updateError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to analyze screenshot',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
