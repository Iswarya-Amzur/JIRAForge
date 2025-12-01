/**
 * Issue Service
 * Business logic for Jira issue operations and caching
 */

import { getUserAssignedIssues, getAllUserAssignedIssues, formatIssuesData, getIssueTransitions, transitionIssue } from '../utils/jira.js';
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
  // Join with screenshots table to get the actual work timestamp (not analysis creation time)
  const timeTrackingData = await supabaseRequest(
    supabaseConfig,
    `analysis_results?user_id=eq.${userId}&work_type=eq.office&active_task_key=not.is.null&select=active_task_key,time_spent_seconds,created_at,screenshots(timestamp)&order=created_at.desc&limit=1000`
  );

  // Aggregate time by issue key and build work sessions
  const timeByIssue = {};
  const lastWorkedByIssue = {};
  const sessionsByIssue = {};

  if (timeTrackingData && Array.isArray(timeTrackingData)) {
    // Sort by screenshot timestamp ascending to build sessions chronologically
    // This ensures sessions are built in the order work actually happened
    const sortedData = [...timeTrackingData].sort((a, b) => {
      const timeA = a.screenshots?.timestamp || a.created_at;
      const timeB = b.screenshots?.timestamp || b.created_at;
      return new Date(timeA) - new Date(timeB);
    });

    sortedData.forEach(entry => {
      const issueKey = entry.active_task_key;

      // Initialize issue data
      if (!timeByIssue[issueKey]) {
        timeByIssue[issueKey] = 0;
        lastWorkedByIssue[issueKey] = entry.created_at;
        sessionsByIssue[issueKey] = [];
      }

      // Add to total time
      timeByIssue[issueKey] += entry.time_spent_seconds || 0;

      // Update last worked timestamp
      if (entry.created_at > lastWorkedByIssue[issueKey]) {
        lastWorkedByIssue[issueKey] = entry.created_at;
      }

      // Build sessions - group consecutive work periods
      // Use the screenshot timestamp (when work actually happened), not analysis created_at
      const screenshotTimestamp = entry.screenshots?.timestamp || entry.created_at;
      const workTime = new Date(screenshotTimestamp);
      const timeSpent = entry.time_spent_seconds || 0;

      // Calculate session time window based on screenshot timestamp
      // Screenshots are captured every 5 minutes, so work ended at screenshot time
      const endTime = workTime;
      const startTime = new Date(workTime.getTime() - (timeSpent * 1000));

      // Check if this entry belongs to an existing session (within 10 minutes gap)
      const sessions = sessionsByIssue[issueKey];
      let addedToSession = false;

      if (sessions.length > 0) {
        const lastSession = sessions[sessions.length - 1];
        const timeSinceLastSession = startTime - new Date(lastSession.endTime);

        // If within 10 minutes, extend the session
        if (timeSinceLastSession <= 10 * 60 * 1000) {
          lastSession.endTime = endTime.toISOString();
          lastSession.duration += timeSpent;
          addedToSession = true;
        }
      }

      // If not added to existing session, create new session
      if (!addedToSession) {
        sessions.push({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: timeSpent,
          date: startTime.toISOString().split('T')[0]
        });
      }
    });
  }

  // Enrich issues with time tracking data and sessions
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
    lastWorkedOn: lastWorkedByIssue[issue.key] || null,
    sessions: sessionsByIssue[issue.key] || []
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

/**
 * Get available status transitions for an issue
 * @param {string} issueKey - Jira issue key (e.g., SCRUM-5)
 * @returns {Promise<Array>} Array of available transitions
 */
export async function getAvailableTransitions(issueKey) {
  try {
    const transitions = await getIssueTransitions(issueKey);

    return transitions.map(transition => ({
      id: transition.id,
      name: transition.name,
      to: {
        id: transition.to.id,
        name: transition.to.name,
        statusCategory: transition.to.statusCategory?.key || 'new'
      }
    }));
  } catch (error) {
    console.error(`Error getting transitions for ${issueKey}:`, error);
    throw new Error(`Failed to get available transitions: ${error.message}`);
  }
}

/**
 * Update issue status by transitioning to new status
 * @param {string} issueKey - Jira issue key (e.g., SCRUM-5)
 * @param {string} transitionId - Transition ID to execute
 * @returns {Promise<Object>} Update result
 */
export async function updateIssueStatus(issueKey, transitionId) {
  try {
    const result = await transitionIssue(issueKey, transitionId);

    return {
      success: true,
      issueKey,
      transitionId,
      message: `Successfully updated ${issueKey} status`
    };
  } catch (error) {
    console.error(`Error updating status for ${issueKey}:`, error);
    throw new Error(`Failed to update issue status: ${error.message}`);
  }
}
