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
 * @returns {Array} Array of cached Jira issues
 */
exports.getUserCachedIssues = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_jira_issues_cache')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching user cached issues:', error);
    return [];
  }
};
