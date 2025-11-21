/**
 * Issue Service
 * Business logic for Jira issue operations and caching
 */

import { getUserAssignedIssues, formatIssuesData } from '../utils/jira.js';
import { getSupabaseConfig, getOrCreateUser, supabaseRequest } from '../utils/supabase.js';
import { JQL_ACTIVE_STATUSES, ISSUE_BATCH_SIZE } from '../config/constants.js';

/**
 * Get user's assigned Jira issues
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} Issues data
 */
export async function getAssignedIssues(accountId) {
  const data = await getUserAssignedIssues(JQL_ACTIVE_STATUSES);

  // Format issues for AI analysis
  const issues = formatIssuesData(data.issues);

  return {
    issues,
    total: data.total || 0
  };
}

/**
 * Update user's assigned Jira issues cache in Supabase
 * This should be called periodically or on-demand to keep cache fresh
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} Cache update result
 */
export async function updateAssignedIssuesCache(accountId) {
  // Get Supabase config
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  // Get or create user record
  const userId = await getOrCreateUser(accountId, supabaseConfig);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Fetch user's assigned issues from Jira
  const jiraData = await getUserAssignedIssues(JQL_ACTIVE_STATUSES);
  const issues = jiraData.issues || [];

  // Delete old cache entries for this user
  await supabaseRequest(
    supabaseConfig,
    `user_jira_issues_cache?user_id=eq.${userId}`,
    {
      method: 'DELETE'
    }
  );

  // Insert new cache entries
  if (issues.length > 0) {
    const cacheEntries = issues.map(issue => ({
      user_id: userId,
      issue_key: issue.key,
      summary: issue.fields.summary || '',
      status: issue.fields.status?.name || 'Unknown',
      project_key: issue.fields.project?.key || '',
      issue_type: issue.fields.issuetype?.name || 'Task',
      updated_at: issue.fields.updated || issue.fields.created || new Date().toISOString()
    }));

    // Insert in batches (Supabase has limits on batch size)
    for (let i = 0; i < cacheEntries.length; i += ISSUE_BATCH_SIZE) {
      const batch = cacheEntries.slice(i, i + ISSUE_BATCH_SIZE);
      await supabaseRequest(
        supabaseConfig,
        'user_jira_issues_cache',
        {
          method: 'POST',
          body: batch
        }
      );
    }
  }

  return {
    cached: issues.length,
    message: `Successfully cached ${issues.length} assigned issues`
  };
}
