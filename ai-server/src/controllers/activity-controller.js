/**
 * Activity Controller
 * Handles endpoints for the new event-based activity tracking pipeline.
 * - POST /api/analyze-batch — text-only LLM task matching for productive records
 * - POST /api/classify-app — LLM classification for unknown apps
 */

const activityService = require('../services/activity-service');
const logger = require('../utils/logger');

/**
 * POST /api/analyze-batch
 * Accepts array of productive activity records with OCR text,
 * runs text-only LLM to match each to a Jira issue,
 * updates activity_records in Supabase.
 */
async function analyzeBatch(req, res, next) {
  try {
    const { records, user_assigned_issues, user_id, organization_id } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'records array is required and must not be empty'
      });
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id is required'
      });
    }

    logger.info(`[ActivityController] Analyzing batch of ${records.length} records for user ${user_id}`);

    const result = await activityService.analyzeBatch(
      records,
      user_assigned_issues || [],
      user_id,
      organization_id
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[ActivityController] Error in analyzeBatch:', error);
    next(error);
  }
}

/**
 * POST /api/classify-app
 * Accepts unknown app info (name + window title + OCR text),
 * LLM returns classification + confidence + reasoning.
 */
async function classifyApp(req, res, next) {
  try {
    const { application_name, window_title, ocr_text } = req.body;

    if (!application_name) {
      return res.status(400).json({
        success: false,
        error: 'application_name is required'
      });
    }

    logger.info(`[ActivityController] Classifying unknown app: ${application_name}`);

    const result = await activityService.classifyUnknownApp(
      application_name,
      window_title || '',
      ocr_text || ''
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[ActivityController] Error in classifyApp:', error);
    next(error);
  }
}

module.exports = { analyzeBatch, classifyApp };
