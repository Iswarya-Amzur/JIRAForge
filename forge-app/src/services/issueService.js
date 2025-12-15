/**
 * Issue Service
 * Business logic for Jira issue operations and caching
 */

import { getUserAssignedIssues, getAllUserAssignedIssues, formatIssuesData, getIssueTransitions, transitionIssue } from '../utils/jira.js';
import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest } from '../utils/supabase.js';
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

  // Get or create organization first (multi-tenancy)
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    // If organization not found, return issues without time tracking
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
  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
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

  // Fetch time tracking data for all issues - filter by organization_id for multi-tenancy
  // Join with screenshots table to get the actual work timestamp (not analysis creation time)
  // Include id for reassignment feature and screenshot details for verification
  // Updated to use screenshots.duration_seconds instead of analysis_results.time_spent_seconds
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

      // Add to total time - use screenshots.duration_seconds instead of time_spent_seconds
      timeByIssue[issueKey] += entry.screenshots?.duration_seconds || 0;

      // Update last worked timestamp
      if (entry.created_at > lastWorkedByIssue[issueKey]) {
        lastWorkedByIssue[issueKey] = entry.created_at;
      }

      // Build sessions - group consecutive work periods
      // Use the screenshot timestamp (when work actually happened), not analysis created_at
      const screenshotTimestamp = entry.screenshots?.timestamp || entry.created_at;
      const workTime = new Date(screenshotTimestamp);
      // Use screenshots.duration_seconds instead of time_spent_seconds
      const timeSpent = entry.screenshots?.duration_seconds || 0;

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
          // Track analysis result IDs for reassignment
          if (!lastSession.analysisResultIds) {
            lastSession.analysisResultIds = [];
          }
          lastSession.analysisResultIds.push(entry.id);
          // Track screenshot info for verification
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
          analysisResultIds: [entry.id], // Track individual analysis_result IDs for reassignment
          screenshots: [] // Track screenshots for verification
        };
        // Add screenshot info if available
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
 * Update user's assigned Jira issues cache in Supabase
 * This should be called periodically or on-demand to keep cache fresh
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @returns {Promise<Object>} Cache update result
 */
export async function updateAssignedIssuesCache(accountId, cloudId) {
  // Get Supabase config
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  // Get or create organization first (multi-tenancy)
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  // Get or create user record
  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Fetch user's assigned issues from Jira
  const jiraData = await getUserAssignedIssues(JQL_ACTIVE_STATUSES);
  const issues = jiraData.issues || [];

  // Delete old cache entries for this user in this organization
  await supabaseRequest(
    supabaseConfig,
    `user_jira_issues_cache?user_id=eq.${userId}&organization_id=eq.${organization.id}`,
    {
      method: 'DELETE'
    }
  );

  // Insert new cache entries - include organization_id for multi-tenancy
  if (issues.length > 0) {
    const cacheEntries = issues.map(issue => ({
      user_id: userId,
      organization_id: organization.id,
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

/**
 * Reassign a work session from one issue to another
 * Updates the analysis_results records in Supabase
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @param {Array<string>} analysisResultIds - IDs of analysis_results to reassign
 * @param {string} fromIssueKey - Original issue key
 * @param {string} toIssueKey - Target issue key to reassign to
 * @param {number} totalSeconds - Total time being reassigned (for logging)
 * @returns {Promise<Object>} Reassignment result
 */
export async function reassignSession(accountId, cloudId, analysisResultIds, fromIssueKey, toIssueKey, totalSeconds) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  // Get organization
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  // Get user record
  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Validate that analysisResultIds is a non-empty array
  if (!analysisResultIds || !Array.isArray(analysisResultIds) || analysisResultIds.length === 0) {
    throw new Error('No analysis results to reassign');
  }

  console.log(`[Reassign] Reassigning ${analysisResultIds.length} records (${totalSeconds}s) from ${fromIssueKey} to ${toIssueKey}`);

  // Extract project key from toIssueKey (e.g., SCRUM-5 -> SCRUM)
  const toProjectKey = toIssueKey.split('-')[0];

  // Update each analysis result to the new issue
  let successCount = 0;
  let errorCount = 0;

  for (const resultId of analysisResultIds) {
    try {
      await supabaseRequest(
        supabaseConfig,
        `analysis_results?id=eq.${resultId}&user_id=eq.${userId}&organization_id=eq.${organization.id}`,
        {
          method: 'PATCH',
          body: {
            active_task_key: toIssueKey,
            active_project_key: toProjectKey,
            reassigned_from: fromIssueKey,
            reassigned_at: new Date().toISOString()
          }
        }
      );
      successCount++;
    } catch (error) {
      console.error(`[Reassign] Error updating result ${resultId}:`, error);
      errorCount++;
    }
  }

  console.log(`[Reassign] Completed: ${successCount} success, ${errorCount} errors`);

  if (successCount === 0) {
    throw new Error('Failed to reassign any records');
  }

  return {
    success: true,
    reassigned: successCount,
    errors: errorCount,
    fromIssueKey,
    toIssueKey,
    totalSeconds,
    message: `Successfully reassigned ${successCount} records from ${fromIssueKey} to ${toIssueKey}`
  };
}

/**
 * Get screenshots for a work session with signed URLs
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @param {Array<string>} analysisResultIds - IDs of analysis_results to fetch screenshots for
 * @returns {Promise<Object>} Screenshots with signed URLs
 */
export async function getSessionScreenshots(accountId, cloudId, analysisResultIds) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  // Get organization
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  // Get user record
  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Validate analysisResultIds
  if (!analysisResultIds || !Array.isArray(analysisResultIds) || analysisResultIds.length === 0) {
    throw new Error('No analysis results provided');
  }

  console.log(`[getSessionScreenshots] Fetching screenshots for ${analysisResultIds.length} analysis results`);

  // Fetch analysis_results with screenshot data
  const analysisIdsParam = analysisResultIds.join(',');
  const analysisResults = await supabaseRequest(
    supabaseConfig,
    `analysis_results?id=in.(${analysisIdsParam})&user_id=eq.${userId}&organization_id=eq.${organization.id}&select=id,screenshot_id,screenshots(id,timestamp,storage_path,thumbnail_url,window_title,application_name)`
  );

  const resultsArray = Array.isArray(analysisResults) ? analysisResults : (analysisResults ? [analysisResults] : []);
  console.log(`[getSessionScreenshots] Found ${resultsArray.length} analysis_results with screenshots`);

  if (resultsArray.length === 0) {
    return { screenshots: [] };
  }

  // Import generateSignedUrl dynamically
  const { generateSignedUrl } = await import('../utils/supabase.js');

  // Generate signed URLs for screenshots in batches
  const BATCH_SIZE = 10;
  const screenshotsWithUrls = [];

  for (let i = 0; i < resultsArray.length; i += BATCH_SIZE) {
    const batch = resultsArray.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (result) => {
        const screenshot = result.screenshots;
        if (!screenshot) return null;

        // Generate signed URL for full-size screenshot (not thumbnail)
        let signed_url = null;
        if (screenshot.storage_path) {
          try {
            // Use the original storage_path for full-size screenshot
            signed_url = await generateSignedUrl(supabaseConfig, 'screenshots', screenshot.storage_path, 3600);
          } catch (err) {
            console.error('[getSessionScreenshots] Error generating signed URL:', err);
          }
        }

        return {
          id: screenshot.id,
          timestamp: screenshot.timestamp,
          window_title: screenshot.window_title,
          application_name: screenshot.application_name,
          signed_url
        };
      })
    );
    screenshotsWithUrls.push(...batchResults);

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < resultsArray.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const validScreenshots = screenshotsWithUrls.filter(Boolean);
  console.log(`[getSessionScreenshots] Returning ${validScreenshots.length} screenshots with signed URLs`);

  return { screenshots: validScreenshots };
}
