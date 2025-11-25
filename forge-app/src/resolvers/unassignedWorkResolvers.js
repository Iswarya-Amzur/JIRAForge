/**
 * Unassigned Work Resolvers
 * Handles operations for clustering and assigning unassigned work sessions
 */

import api, { route } from '@forge/api';
import { fetch } from '@forge/api';
import { getSupabaseConfig, getOrCreateUser, supabaseRequest } from '../utils/supabase.js';

/**
 * Get unassigned work sessions for current user
 */
async function getUnassignedWork(req) {
  try {
    const { accountId } = req.context;
    const { limit, offset, dateFrom, dateTo } = req.payload || {};

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);

    // Build query string
    let query = `analysis_results?select=*,screenshots(id,window_title,application_name,timestamp,thumbnail_url,storage_path)&user_id=eq.${userId}&active_task_key=is.null&order=created_at.desc`;

    if (limit) query += `&limit=${limit}`;
    if (offset) query += `&offset=${offset}`;
    if (dateFrom) query += `&created_at=gte.${dateFrom}`;
    if (dateTo) query += `&created_at=lte.${dateTo}`;

    const results = await supabaseRequest(supabaseConfig, query);

    // Flatten data structure
    const sessions = (results || []).map(result => ({
      ...result,
      screenshot_id: result.screenshots?.id || result.screenshot_id,
      window_title: result.screenshots?.window_title,
      application_name: result.screenshots?.application_name,
      timestamp: result.screenshots?.timestamp || result.created_at,
      thumbnail_url: result.screenshots?.thumbnail_url,
      storage_path: result.screenshots?.storage_path
    }));

    return {
      success: true,
      sessions,
      total: sessions.length
    };

  } catch (error) {
    console.error('Error getting unassigned work:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cluster unassigned work using AI
 */
async function clusterUnassignedWork(req) {
  try {
    const { accountId } = req.context;
    const { sessions } = req.payload;

    if (!sessions || sessions.length === 0) {
      return { success: true, groups: [], total_groups: 0 };
    }

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);

    // Get user's cached issues for AI suggestions
    const cachedIssues = await supabaseRequest(
      supabaseConfig,
      `user_jira_issues_cache?user_id=eq.${userId}&select=issue_key,summary,status`
    );

    // Call AI server clustering endpoint
    const aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:3001';
    const response = await fetch(`${aiServerUrl}/api/cluster-unassigned-work`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessions,
        userIssues: cachedIssues || []
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI clustering failed: ${errorText}`);
    }

    const clusteringResult = await response.json();

    return {
      success: true,
      ...clusteringResult
    };

  } catch (error) {
    console.error('Error clustering unassigned work:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Assign a group of sessions to existing Jira issue
 */
async function assignToExistingIssue(req) {
  try {
    const { accountId } = req.context;
    const { sessionIds, issueKey, groupId, totalSeconds } = req.payload;

    if (!sessionIds || sessionIds.length === 0) {
      return { success: false, error: 'No sessions provided' };
    }

    if (!issueKey) {
      return { success: false, error: 'No issue key provided' };
    }

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);

    // Update analysis_results to mark sessions as assigned
    const updateResponse = await supabaseRequest(
      supabaseConfig,
      `analysis_results?screenshot_id=in.(${sessionIds.map(id => `"${id}"`).join(',')})`,
      {
        method: 'PATCH',
        body: {
          active_task_key: issueKey,
          manually_assigned: true,
          assignment_group_id: groupId,
          updated_at: new Date().toISOString()
        }
      }
    );

    // Create worklog in Jira
    const worklogResponse = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}/worklog`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeSpentSeconds: totalSeconds,
          comment: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `Time tracked from ${sessionIds.length} work session(s), grouped and assigned manually.`
                  }
                ]
              }
            ]
          },
          started: new Date().toISOString()
        })
      }
    );

    if (!worklogResponse.ok) {
      const errorText = await worklogResponse.text();
      throw new Error(`Failed to create worklog: ${errorText}`);
    }

    const worklog = await worklogResponse.json();

    return {
      success: true,
      assigned_count: sessionIds.length,
      worklog_id: worklog.id,
      issue_key: issueKey
    };

  } catch (error) {
    console.error('Error assigning to existing issue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create new Jira issue and assign work group to it
 */
async function createIssueAndAssign(req) {
  try {
    const { accountId } = req.context;
    const { sessionIds, issueSummary, issueDescription, projectKey, issueType, totalSeconds, groupId } = req.payload;

    if (!sessionIds || sessionIds.length === 0) {
      return { success: false, error: 'No sessions provided' };
    }

    if (!issueSummary) {
      return { success: false, error: 'Issue summary required' };
    }

    if (!projectKey) {
      return { success: false, error: 'Project key required' };
    }

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig);

    // Create new Jira issue
    const createIssueResponse = await api.asUser().requestJira(
      route`/rest/api/3/issue`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: issueSummary,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: issueDescription || `Work performed across ${sessionIds.length} sessions.\n\nTotal time: ${formatDuration(totalSeconds)}\n\nCreated from time tracking data.`
                    }
                  ]
                }
              ]
            },
            issuetype: { name: issueType || 'Task' },
            labels: ['time-tracked', 'auto-created']
          }
        })
      }
    );

    if (!createIssueResponse.ok) {
      const errorText = await createIssueResponse.text();
      throw new Error(`Failed to create issue: ${errorText}`);
    }

    const newIssue = await createIssueResponse.json();
    const newIssueKey = newIssue.key;

    // Update analysis_results to mark sessions as assigned to new issue
    await supabaseRequest(
      supabaseConfig,
      `analysis_results?screenshot_id=in.(${sessionIds.map(id => `"${id}"`).join(',')})`,
      {
        method: 'PATCH',
        body: {
          active_task_key: newIssueKey,
          manually_assigned: true,
          assignment_group_id: groupId,
          updated_at: new Date().toISOString()
        }
      }
    );

    // Create worklog on new issue
    const worklogResponse = await api.asUser().requestJira(
      route`/rest/api/3/issue/${newIssueKey}/worklog`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeSpentSeconds: totalSeconds,
          comment: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `Initial time logged from ${sessionIds.length} work session(s).`
                  }
                ]
              }
            ]
          },
          started: new Date().toISOString()
        })
      }
    );

    if (!worklogResponse.ok) {
      const errorText = await worklogResponse.text();
      console.warn(`Created issue ${newIssueKey} but failed to add worklog: ${errorText}`);
    }

    const worklog = await worklogResponse.json();

    // Cache the new issue for future AI analysis
    await supabaseRequest(
      supabaseConfig,
      'user_jira_issues_cache',
      {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: {
          user_id: userId,
          issue_key: newIssueKey,
          summary: issueSummary,
          status: 'To Do',
          project_key: projectKey
        }
      }
    );

    // Log created issue
    await supabaseRequest(
      supabaseConfig,
      'created_issues_log',
      {
        method: 'POST',
        body: {
          user_id: userId,
          issue_key: newIssueKey,
          issue_summary: issueSummary,
          assignment_group_id: groupId,
          session_count: sessionIds.length,
          total_time_seconds: totalSeconds
        }
      }
    );

    return {
      success: true,
      issue_key: newIssueKey,
      issue_id: newIssue.id,
      assigned_count: sessionIds.length,
      worklog_id: worklog?.id
    };

  } catch (error) {
    console.error('Error creating issue and assigning work:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's projects (for create issue dropdown)
 */
async function getUserProjects(req) {
  try {
    const response = await api.asUser().requestJira(
      route`/rest/api/3/project`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    const projects = await response.json();

    return {
      success: true,
      projects: projects.map(p => ({
        key: p.key,
        name: p.name,
        id: p.id
      }))
    };

  } catch (error) {
    console.error('Error getting user projects:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format duration helper
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Register all unassigned work resolvers
 */
export function registerUnassignedWorkResolvers(resolver) {
  resolver.define('getUnassignedWork', getUnassignedWork);
  resolver.define('clusterUnassignedWork', clusterUnassignedWork);
  resolver.define('assignToExistingIssue', assignToExistingIssue);
  resolver.define('createIssueAndAssign', createIssueAndAssign);
  resolver.define('getUserProjects', getUserProjects);
}
