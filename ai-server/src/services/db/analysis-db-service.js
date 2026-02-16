/**
 * Analysis Database Service Module
 * Handles analysis results database operations
 */

const { getClient } = require('./supabase-client');
const logger = require('../../utils/logger');
const { getUTCISOString } = require('../../utils/datetime');

/**
 * Save analysis result to database
 * @param {Object} analysisData - Analysis result data
 * @returns {Promise<Object>} Created analysis record
 */
async function saveAnalysisResult(analysisData) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('analysis_results')
      .insert(analysisData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error saving analysis result:', error);
    throw new Error(`Failed to save analysis result: ${error.message}`);
  }
}

/**
 * Mark worklog as created
 * @param {string} screenshotId - Screenshot ID
 * @param {string} worklogId - Jira worklog ID
 * @returns {Promise<void>}
 */
async function markWorklogCreated(screenshotId, worklogId) {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('analysis_results')
      .update({
        worklog_created: true,
        worklog_id: worklogId,
        worklog_created_at: getUTCISOString()
      })
      .eq('screenshot_id', screenshotId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error marking worklog as created:', error);
    throw new Error(`Failed to mark worklog as created: ${error.message}`);
  }
}

/**
 * Get unassigned work sessions for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, offset, dateFrom, dateTo, organizationId)
 * @returns {Promise<Array>} Array of unassigned work sessions with screenshot data
 */
async function getUnassignedWork(userId, options = {}) {
  try {
    const supabase = getClient();
    const { limit = 100, offset = 0, dateFrom = null, dateTo = null, organizationId = null } = options;

    let query = supabase
      .from('analysis_results')
      .select(`
        *,
        screenshots (
          id,
          user_id,
          window_title,
          application_name,
          timestamp,
          thumbnail_url,
          storage_path
        )
      `)
      .eq('user_id', userId)
      .is('active_task_key', null)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Filter by organization if provided (multi-tenancy)
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    // Add date filters if provided
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Flatten the data structure for easier use
    const flattenedData = (data || []).map(result => ({
      ...result,
      screenshot_id: result.screenshots?.id || result.screenshot_id,
      window_title: result.screenshots?.window_title,
      application_name: result.screenshots?.application_name,
      timestamp: result.screenshots?.timestamp || result.created_at,
      thumbnail_url: result.screenshots?.thumbnail_url,
      storage_path: result.screenshots?.storage_path
    }));

    logger.info(`Fetched ${flattenedData.length} unassigned work sessions for user ${userId}`);
    return flattenedData;

  } catch (error) {
    logger.error('Error fetching unassigned work:', error);
    return [];
  }
}

/**
 * Assign a group of sessions to a Jira issue
 * @param {Array} sessionIds - Array of screenshot IDs
 * @param {string} issueKey - Jira issue key
 * @param {Object} metadata - Additional metadata about the assignment
 * @returns {Promise<Object>} Assignment result
 */
async function assignWorkGroup(sessionIds, issueKey, metadata = {}) {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('analysis_results')
      .update({
        active_task_key: issueKey,
        manually_assigned: true,
        assignment_group_id: metadata.groupId || null,
        updated_at: getUTCISOString()
      })
      .in('screenshot_id', sessionIds);

    if (error) {
      throw error;
    }

    logger.info(`Assigned ${sessionIds.length} sessions to ${issueKey}`);
    return { success: true, assigned_count: sessionIds.length };

  } catch (error) {
    logger.error('Error assigning work group:', error);
    throw new Error(`Failed to assign work group: ${error.message}`);
  }
}

/**
 * Get count of unassigned work sessions
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID for multi-tenancy filtering (optional)
 * @returns {Promise<number>} Count of unassigned sessions
 */
async function getUnassignedWorkCount(userId, organizationId = null) {
  try {
    const supabase = getClient();
    let query = supabase
      .from('analysis_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('active_task_key', null);

    // Filter by organization if provided (multi-tenancy)
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    logger.error('Error fetching unassigned work count:', error);
    return 0;
  }
}

/**
 * Get analysis result by screenshot ID
 * @param {string} screenshotId - Screenshot ID
 * @param {string} organizationId - Organization ID for multi-tenancy filtering (optional but recommended)
 * @returns {Promise<Object|null>} Analysis result or null
 */
async function getAnalysisResultByScreenshotId(screenshotId, organizationId = null) {
  try {
    const supabase = getClient();
    let query = supabase
      .from('analysis_results')
      .select('*')
      .eq('screenshot_id', screenshotId);

    // SECURITY: Apply organization filter if provided (recommended for multi-tenancy)
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else {
      logger.warn('[AnalysisDB] getAnalysisResultByScreenshotId called without organizationId', { screenshotId });
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error fetching analysis result:', error);
    return null;
  }
}

module.exports = {
  saveAnalysisResult,
  markWorklogCreated,
  getUnassignedWork,
  assignWorkGroup,
  getUnassignedWorkCount,
  getAnalysisResultByScreenshotId
};
