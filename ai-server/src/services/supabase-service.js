const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const logger = require('../utils/logger');

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Download a file from Supabase Storage
 */
exports.downloadFile = async (bucket, filePath) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      throw error;
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await data.arrayBuffer());
    return buffer;
  } catch (error) {
    logger.error('Error downloading file from Supabase:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

/**
 * Save analysis result to database
 */
exports.saveAnalysisResult = async (analysisData) => {
  try {
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
};

/**
 * Update screenshot status
 */
exports.updateScreenshotStatus = async (screenshotId, status, errorMessage = null) => {
  try {
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
};

/**
 * Update document status
 */
exports.updateDocumentStatus = async (documentId, status, errorMessage = null) => {
  try {
    const updateData = {
      processing_status: status,
      processed_at: status === 'completed' ? new Date().toISOString() : null
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error updating document status:', error);
    throw new Error(`Failed to update document status: ${error.message}`);
  }
};

/**
 * Update document data (extracted text, parsed requirements, etc.)
 */
exports.updateDocumentData = async (documentId, data) => {
  try {
    const { error } = await supabase
      .from('documents')
      .update(data)
      .eq('id', documentId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error updating document data:', error);
    throw new Error(`Failed to update document data: ${error.message}`);
  }
};

/**
 * Mark worklog as created
 */
exports.markWorklogCreated = async (screenshotId, worklogId) => {
  try {
    const { error } = await supabase
      .from('analysis_results')
      .update({
        worklog_created: true,
        worklog_id: worklogId,
        worklog_created_at: new Date().toISOString()
      })
      .eq('screenshot_id', screenshotId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error marking worklog as created:', error);
    throw new Error(`Failed to mark worklog as created: ${error.message}`);
  }
};

/**
 * Get user's Atlassian account ID from Supabase
 */
exports.getUserAtlassianAccountId = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('atlassian_account_id')
      .eq('id', userId)
      .single();

    if (error || !data) {
      logger.warn('User not found or no Atlassian account ID', { userId, error });
      return null;
    }

    return data.atlassian_account_id;
  } catch (error) {
    logger.error('Error fetching user Atlassian account ID:', error);
    return null;
  }
};

/**
 * Get user's Jira issues for correlation
 * This function will be called by the controller which will fetch issues via Forge app
 * For now, returns empty array - the controller will handle fetching
 */
exports.getUserJiraIssues = async (userId, atlassianAccountId = null) => {
  try {
    // If we have a Forge app URL configured, we could call it here
    // But since Forge apps use resolvers, we'll handle this in the controller
    // which can call the Forge app's resolver via the webhook payload

    // For now, return empty array - the controller will fetch via Forge
    logger.debug('getUserJiraIssues called - will be fetched by controller', { userId });
    return [];
  } catch (error) {
    logger.error('Error fetching user Jira issues:', error);
    return [];
  }
};

/**
 * Fetch pending screenshots from Supabase
 * @param {number} limit - Maximum number of screenshots to fetch
 * @returns {Array} Array of pending screenshots
 */
exports.getPendingScreenshots = async (limit = 10) => {
  try {
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
    // Check if this is a network error (expected in corporate environments)
    const errorMessage = error.message || '';
    const isNetworkError = 
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('certificate') ||
      errorMessage.includes('fetch failed');

    if (isNetworkError) {
      // Re-throw network errors so polling service can handle them gracefully
      // Don't log here - let the polling service decide log level
      throw error;
    } else {
      // Log non-network errors
      logger.error('Error fetching pending screenshots:', error);
      throw new Error(`Failed to fetch pending screenshots: ${error.message}`);
    }
  }
};

/**
 * Fetch user's cached Jira issues
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID for multi-tenancy filtering (optional)
 * @returns {Array} Array of cached Jira issues
 */
exports.getUserCachedIssues = async (userId, organizationId = null) => {
  try {
    let query = supabase
      .from('user_jira_issues_cache')
      .select('*')
      .eq('user_id', userId);

    // Filter by organization if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching user cached issues:', error);
    return [];
  }
};

/**
 * Fetch unassigned work sessions for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, offset, dateFrom, dateTo, organizationId)
 * @returns {Array} Array of unassigned work sessions with screenshot data
 */
exports.getUnassignedWork = async (userId, options = {}) => {
  try {
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
};

/**
 * Assign a group of sessions to a Jira issue
 * @param {Array} sessionIds - Array of screenshot IDs
 * @param {string} issueKey - Jira issue key
 * @param {Object} metadata - Additional metadata about the assignment
 * @returns {Promise<Object>} Assignment result
 */
exports.assignWorkGroup = async (sessionIds, issueKey, metadata = {}) => {
  try {
    const { error } = await supabase
      .from('analysis_results')
      .update({
        active_task_key: issueKey,
        manually_assigned: true,
        assignment_group_id: metadata.groupId || null,
        updated_at: new Date().toISOString()
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
};

/**
 * Get count of unassigned work sessions
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID for multi-tenancy filtering (optional)
 * @returns {Promise<number>} Count of unassigned sessions
 */
exports.getUnassignedWorkCount = async (userId, organizationId = null) => {
  try {
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
};

/**
 * CLUSTERING FUNCTIONS FOR UNASSIGNED WORK
 */

/**
 * Get all users who have unassigned activities (grouped by user and organization)
 * @returns {Promise<Array>} Array of user objects with unassigned work and their organization
 */
exports.getUsersWithUnassignedWork = async () => {
  try {
    const { data, error } = await supabase
      .from('unassigned_activity')
      .select('user_id, organization_id')
      .eq('manually_assigned', false)
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    // Get unique user_id + organization_id combinations
    const uniqueCombos = new Map();
    data.forEach(item => {
      const key = `${item.user_id}_${item.organization_id}`;
      if (!uniqueCombos.has(key)) {
        uniqueCombos.set(key, { id: item.user_id, organization_id: item.organization_id });
      }
    });

    return Array.from(uniqueCombos.values());
  } catch (error) {
    logger.error('Error fetching users with unassigned work:', error);
    return [];
  }
};

/**
 * Get unassigned activities for a specific user within an organization
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID for multi-tenancy filtering
 * @returns {Promise<Array>} Array of unassigned activity sessions
 */
exports.getUnassignedActivities = async (userId, organizationId) => {
  try {
    let query = supabase
      .from('unassigned_activity')
      .select(`
        id,
        screenshot_id,
        timestamp,
        window_title,
        application_name,
        extracted_text,
        time_spent_seconds,
        reason,
        confidence_score,
        metadata,
        analysis_result_id,
        organization_id
      `)
      .eq('user_id', userId)
      .eq('manually_assigned', false)
      .order('timestamp', { ascending: false });

    // Filter by organization if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Fetch analysis_metadata for each activity to get AI reasoning
    const enrichedData = await Promise.all(
      data.map(async (activity) => {
        const { data: analysisData } = await supabase
          .from('analysis_results')
          .select('analysis_metadata')
          .eq('id', activity.analysis_result_id)
          .single();

        return {
          ...activity,
          reasoning: analysisData?.analysis_metadata?.reasoning || 'No description available'
        };
      })
    );

    return enrichedData;
  } catch (error) {
    logger.error('Error fetching unassigned activities:', error);
    throw new Error(`Failed to fetch unassigned activities: ${error.message}`);
  }
};

/**
 * Get user's active Jira issues for better AI recommendations
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID for multi-tenancy filtering
 * @returns {Promise<Array>} Array of user's active issues with summaries
 */
exports.getUserActiveIssues = async (userId, organizationId) => {
  try {
    // First try to get from cache (has summaries) - filter by organization
    let cacheQuery = supabase
      .from('user_jira_issues_cache')
      .select('issue_key, summary, project_key, status')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (organizationId) {
      cacheQuery = cacheQuery.eq('organization_id', organizationId);
    }

    const { data: cachedIssues, error: cacheError } = await cacheQuery;

    if (!cacheError && cachedIssues && cachedIssues.length > 0) {
      return cachedIssues.map(issue => ({
        issue_key: issue.issue_key,
        summary: issue.summary,
        project: issue.project_key,
        status: issue.status
      }));
    }

    // Fallback: get from analysis_results (no summaries, but at least we have keys)
    const { data, error } = await supabase
      .from('analysis_results')
      .select('active_task_key, active_project_key')
      .eq('user_id', userId)
      .not('active_task_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // Get unique issues
    const uniqueIssues = [...new Set(data.map(item => item.active_task_key))];

    return uniqueIssues.map(key => ({
      issue_key: key,
      summary: '', // No summary available from analysis_results
      project: data.find(d => d.active_task_key === key)?.active_project_key
    }));
  } catch (error) {
    logger.error('Error fetching user active issues:', error);
    return [];
  }
};

/**
 * Check if user has recent groups (to avoid re-clustering too frequently)
 * @param {string} userId - User ID
 * @param {number} hoursAgo - How many hours ago to check
 * @param {string} organizationId - Organization ID for multi-tenancy filtering
 * @returns {Promise<Array>} Recent groups
 */
exports.getRecentGroups = async (userId, hoursAgo = 24, organizationId = null) => {
  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('unassigned_work_groups')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', cutoffTime);

    // Filter by organization if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching recent groups:', error);
    return [];
  }
};

/**
 * Create a new unassigned work group
 * @param {Object} groupData - Group data from AI clustering (should include organization_id)
 * @returns {Promise<Object>} Created group record
 */
exports.createUnassignedGroup = async (groupData) => {
  try {
    const { data, error } = await supabase
      .from('unassigned_work_groups')
      .insert({
        user_id: groupData.user_id,
        organization_id: groupData.organization_id,  // Multi-tenancy: Include organization_id
        group_label: groupData.group_label,
        group_description: groupData.group_description,
        confidence_level: groupData.confidence_level,
        recommended_action: groupData.recommended_action,
        suggested_issue_key: groupData.suggested_issue_key,
        recommendation_reason: groupData.recommendation_reason,
        session_count: groupData.session_count,
        total_seconds: groupData.total_seconds,
        clustering_metadata: groupData.clustering_metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info(`Created unassigned group: ${data.id} for user ${groupData.user_id} in org ${groupData.organization_id}`);
    return data;
  } catch (error) {
    logger.error('Error creating unassigned group:', error);
    throw new Error(`Failed to create unassigned group: ${error.message}`);
  }
};

/**
 * Add a member to an unassigned work group
 * @param {Object} memberData - Member data
 * @returns {Promise<Object>} Created member record
 */
exports.addGroupMember = async (memberData) => {
  try {
    const { data, error } = await supabase
      .from('unassigned_group_members')
      .insert({
        group_id: memberData.group_id,
        unassigned_activity_id: memberData.unassigned_activity_id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error adding group member:', error);
    throw new Error(`Failed to add group member: ${error.message}`);
  }
};
