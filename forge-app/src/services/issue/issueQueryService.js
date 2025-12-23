/**
 * Issue Query Service
 * Handles fetching and querying Jira issues
 */

import { getUserAssignedIssues, getAllUserAssignedIssues, formatIssuesData } from '../../utils/jira.js';
import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest } from '../../utils/supabase.js';
import { JQL_ACTIVE_STATUSES } from '../../config/constants.js';

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
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @returns {Promise<Object>} Issues with time tracking data
 */
export async function getActiveIssuesWithTime(accountId, cloudId) {
  // Fetch ALL assigned issues from Jira (regardless of status)
  const jiraData = await getAllUserAssignedIssues();
  console.log('[BACKEND] Jira returned issues:', jiraData.issues?.length || 0);
  const issues = jiraData.issues || [];

  // Get Supabase config to fetch time tracking data
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    // If Supabase not configured, return issues without time tracking
    return {
      issues: formatIssuesWithoutTime(issues),
      total: issues.length
    };
  }

  // Get or create organization first (multi-tenancy)
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    return {
      issues: formatIssuesWithoutTime(issues),
      total: issues.length
    };
  }

  // Get or create user record
  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
  if (!userId) {
    return {
      issues: formatIssuesWithoutTime(issues),
      total: issues.length
    };
  }

  // Fetch time tracking data for all issues
  const timeTrackingData = await supabaseRequest(
    supabaseConfig,
    `analysis_results?user_id=eq.${userId}&organization_id=eq.${organization.id}&work_type=eq.office&active_task_key=not.is.null&select=id,screenshot_id,active_task_key,created_at,screenshots(id,timestamp,duration_seconds,storage_path,window_title,application_name)&order=created_at.desc&limit=1000`
  );

  // Aggregate time by issue key and build work sessions
  const timeByIssue = {};
  const lastWorkedByIssue = {};
  const sessionsByIssue = {};

  if (timeTrackingData && Array.isArray(timeTrackingData)) {
    // Sort by screenshot timestamp ascending to build sessions chronologically
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
      timeByIssue[issueKey] += entry.screenshots?.duration_seconds || 0;

      // Update last worked timestamp
      if (entry.created_at > lastWorkedByIssue[issueKey]) {
        lastWorkedByIssue[issueKey] = entry.created_at;
      }

      // Build sessions - group consecutive work periods
      const screenshotTimestamp = entry.screenshots?.timestamp || entry.created_at;
      const workTime = new Date(screenshotTimestamp);
      const timeSpent = entry.screenshots?.duration_seconds || 0;

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
          if (!lastSession.analysisResultIds) {
            lastSession.analysisResultIds = [];
          }
          lastSession.analysisResultIds.push(entry.id);
          if (!lastSession.screenshots) {
            lastSession.screenshots = [];
          }
          if (entry.screenshots) {
            lastSession.screenshots.push({
              id: entry.screenshots.id,
              timestamp: entry.screenshots.timestamp,
              storagePath: entry.screenshots.storage_path,
              windowTitle: entry.screenshots.window_title,
              applicationName: entry.screenshots.application_name
            });
          }
          addedToSession = true;
        }
      }

      // If not added to existing session, create new session
      if (!addedToSession) {
        const newSession = {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: timeSpent,
          date: startTime.toISOString().split('T')[0],
          analysisResultIds: [entry.id],
          screenshots: []
        };
        if (entry.screenshots) {
          newSession.screenshots.push({
            id: entry.screenshots.id,
            timestamp: entry.screenshots.timestamp,
            storagePath: entry.screenshots.storage_path,
            windowTitle: entry.screenshots.window_title,
            applicationName: entry.screenshots.application_name
          });
        }
        sessions.push(newSession);
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
 * Format issues without time tracking data
 * @param {Array} issues - Raw Jira issues
 * @returns {Array} Formatted issues
 */
function formatIssuesWithoutTime(issues) {
  return issues.map(issue => ({
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
  }));
}
