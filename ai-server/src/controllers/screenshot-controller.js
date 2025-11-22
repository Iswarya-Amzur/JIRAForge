const screenshotService = require('../services/screenshot-service');
const supabaseService = require('../services/supabase-service');
const logger = require('../utils/logger');

/**
 * Analyze screenshot endpoint
 * Triggered by Supabase webhook when a new screenshot is uploaded
 */
exports.analyzeScreenshot = async (req, res) => {
  try {
    // Supabase webhooks send data in req.body.record
    const webhookData = req.body.record || req.body;

    const {
      id: screenshot_id,
      user_id,
      storage_url,
      storage_path,
      window_title,
      application_name,
      timestamp,
      user_assigned_issues // Optional: User's assigned Jira issues from Forge app
    } = webhookData;

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

    logger.info('Starting screenshot analysis', {
      screenshot_id,
      user_id,
      application_name,
      hasAssignedIssues: !!parsedAssignedIssues && parsedAssignedIssues.length > 0
    });

    // Download screenshot from Supabase Storage
    const imageBuffer = await supabaseService.downloadFile('screenshots', storage_path);

    // Extract text from screenshot using OCR
    const extractedText = await screenshotService.extractText(imageBuffer);

    // Analyze the screenshot and determine Jira task
    // Pass user's assigned issues if provided (from webhook payload)
    const analysis = await screenshotService.analyzeActivity({
      extractedText,
      windowTitle: window_title,
      applicationName: application_name,
      timestamp,
      userId: user_id,
      userAssignedIssues: parsedAssignedIssues || [] // Pass assigned issues to analysis
    });

    // Save analysis results to Supabase
    await supabaseService.saveAnalysisResult({
      screenshot_id,
      user_id,
      time_spent_seconds: analysis.timeSpentSeconds,
      active_task_key: analysis.taskKey,
      active_project_key: analysis.projectKey,
      confidence_score: analysis.confidenceScore,
      extracted_text: extractedText,
      detected_jira_keys: analysis.detectedJiraKeys,
      is_active_work: analysis.isActiveWork,
      is_idle: analysis.isIdle,
      ai_model_version: analysis.modelVersion,
      analysis_metadata: analysis.metadata
    });

    // Update screenshot status
    await supabaseService.updateScreenshotStatus(screenshot_id, 'analyzed');

    // If configured, create worklog in Jira
    if (analysis.taskKey && analysis.isActiveWork && process.env.AUTO_CREATE_WORKLOGS === 'true') {
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
        is_active_work: analysis.isActiveWork
      }
    });

  } catch (error) {
    logger.error('Screenshot analysis error:', error);

    // Update screenshot status to failed
    if (req.body.screenshot_id) {
      try {
        await supabaseService.updateScreenshotStatus(
          req.body.screenshot_id,
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
