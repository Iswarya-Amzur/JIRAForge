/**
 * Issue Service
 * Business logic for Jira issue operations and caching
 */

import { getUserAssignedIssues, getAllUserAssignedIssues, formatIssuesData } from '../utils/jira.js';
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
 * Get user's active issues with time tracking data
 * Fetches assigned issues from Jira and enriches with time tracking from Supabase
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} Issues with time tracking data
 */
export async function getActiveIssuesWithTime(accountId) {
  // Fetch ALL assigned issues from Jira (regardless of status)
  const jiraData = await getAllUserAssignedIssues();
  console.log('[BACKEND] Jira returned issues:', jiraData.issues?.length || 0);
  const issues = jiraData.issues || [];

  // Get Supabase config to fetch time tracking data
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    // If Supabase not configured, return issues without time tracking
    return {
      issues: issues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary || '',
        status: issue.fields.status?.name || 'Unknown',
        statusCategory: issue.fields.status?.statusCategory?.key || 'new',
        priority: issue.fields.priority?.name || 'Medium',
        priorityIconUrl: issue.fields.priority?.iconUrl || '',
        issueType: issue.fields.issuetype?.name || 'Task',
        issueTypeIconUrl: issue.fields.issuetype?.iconUrl || '',
        projectKey: issue.fields.project?.key || '',
        timeTracked: 0,
        lastWorkedOn: null
      })),
      total: issues.length
    };
  }

  // Get or create user record
  const userId = await getOrCreateUser(accountId, supabaseConfig);
  if (!userId) {
    // Return issues without time tracking if user not found
    return {
      issues: issues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary || '',
        status: issue.fields.status?.name || 'Unknown',
        statusCategory: issue.fields.status?.statusCategory?.key || 'new',
        priority: issue.fields.priority?.name || 'Medium',
        priorityIconUrl: issue.fields.priority?.iconUrl || '',
        issueType: issue.fields.issuetype?.name || 'Task',
        issueTypeIconUrl: issue.fields.issuetype?.iconUrl || '',
        projectKey: issue.fields.project?.key || '',
        timeTracked: 0,
        lastWorkedOn: null
      })),
      total: issues.length
    };
  }

  // Fetch time tracking data for all issues
  const timeTrackingData = await supabaseRequest(
    supabaseConfig,
    `analysis_results?user_id=eq.${userId}&is_active_work=eq.true&is_idle=eq.false&active_task_key=not.is.null&select=active_task_key,time_spent_seconds,created_at&order=created_at.desc&limit=1000`
  );

  // Aggregate time by issue key
  const timeByIssue = {};
  const lastWorkedByIssue = {};

  if (timeTrackingData && Array.isArray(timeTrackingData)) {
    timeTrackingData.forEach(entry => {
      const issueKey = entry.active_task_key;
      if (!timeByIssue[issueKey]) {
        timeByIssue[issueKey] = 0;
        lastWorkedByIssue[issueKey] = entry.created_at;
      }
      timeByIssue[issueKey] += entry.time_spent_seconds || 0;
      // Keep the most recent timestamp
      if (entry.created_at > lastWorkedByIssue[issueKey]) {
        lastWorkedByIssue[issueKey] = entry.created_at;
      }
    });
  }

  // Enrich issues with time tracking data
  const enrichedIssues = issues.map(issue => ({
    key: issue.key,
    summary: issue.fields.summary || '',
    status: issue.fields.status?.name || 'Unknown',
    statusCategory: issue.fields.status?.statusCategory?.key || 'new',
    priority: issue.fields.priority?.name || 'Medium',
    priorityIconUrl: issue.fields.priority?.iconUrl || '',
    issueType: issue.fields.issuetype?.name || 'Task',
    issueTypeIconUrl: issue.fields.issuetype?.iconUrl || '',
    projectKey: issue.fields.project?.key || '',
    timeTracked: timeByIssue[issue.key] || 0,
    lastWorkedOn: lastWorkedByIssue[issue.key] || null
  }));

  return {
    issues: enrichedIssues,
    total: enrichedIssues.length
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
