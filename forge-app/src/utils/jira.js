/**
 * Jira API utility functions
 * All Jira-related operations should go through these helpers
 */

import api, { route } from '@forge/api';
import { JQL_ACTIVE_STATUSES, MAX_JIRA_SEARCH_RESULTS } from '../config/constants.js';

/**
 * Get user's assigned issues from Jira
 * @param {Array<string>} statuses - Issue statuses to filter (default: In Progress)
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Object>} Jira search response
 */
export async function getUserAssignedIssues(statuses = JQL_ACTIVE_STATUSES, maxResults = MAX_JIRA_SEARCH_RESULTS) {
  const jql = `assignee = currentUser() AND (status = "${statuses.join('" OR status = "')}")ORDER BY updated DESC`;

  const response = await api.asUser().requestJira(
    route`/rest/api/3/search/jql`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jql: jql,
        maxResults: maxResults,
        fields: ['summary', 'status', 'project', 'issuetype', 'updated']
      })
    }
  );

  return response.json();
}

/**
 * Get ALL user's assigned issues from Jira (regardless of status)
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Object>} Jira search response
 */
export async function getAllUserAssignedIssues(maxResults = MAX_JIRA_SEARCH_RESULTS) {
  // Include all issues in open sprints (including Done) - time tracking should show for completed work
  const jql = 'assignee = currentUser() AND Sprint in openSprints() ORDER BY status ASC, dueDate ASC, rank ASC';

  console.log('[JIRA API] Fetching issues with JQL:', jql);
  const response = await api.asUser().requestJira(
    route`/rest/api/3/search/jql`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jql: jql,
        maxResults: maxResults,
        fields: ['summary', 'status', 'project', 'issuetype', 'priority', 'updated']
      })
    }
  );

  const result = await response.json();
  console.log('[JIRA API] Response status:', response.status);
  console.log('[JIRA API] Issues returned:', result.issues?.length || 0);
  console.log('[JIRA API] Full result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Create a new Jira issue
 * @param {string} projectKey - Jira project key
 * @param {Object} issueData - Issue data (summary, description, issuetype, etc.)
 * @returns {Promise<Object>} Created issue response
 */
export async function createJiraIssue(projectKey, issueData) {
  const response = await api.asUser().requestJira(
    route`/rest/api/3/issue`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          ...issueData
        }
      })
    }
  );

  return response.json();
}

/**
 * Create a worklog entry for a Jira issue
 * @param {string} issueKey - Jira issue key (e.g., PROJ-123)
 * @param {number} timeSpentSeconds - Time spent in seconds
 * @param {string} startedAt - ISO timestamp when work started
 * @returns {Promise<Object>} Created worklog response
 */
export async function createJiraWorklog(issueKey, timeSpentSeconds, startedAt) {
  const response = await api.asUser().requestJira(
    route`/rest/api/3/issue/${issueKey}/worklog`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timeSpentSeconds,
        started: startedAt
      })
    }
  );

  return response.json();
}

/**
 * Check if current user has specific Jira permissions
 * @param {Array<string>} permissions - Permission keys to check (e.g., ['ADMINISTER', 'CREATE_ISSUES'])
 * @param {string} projectKey - Optional project key for project-specific permissions
 * @returns {Promise<Object>} Permissions object with havePermission flags
 */
export async function checkUserPermissions(permissions, projectKey = null) {
  const permissionsParam = permissions.join(',');
  const endpoint = projectKey
    ? route`/rest/api/3/mypermissions?permissions=${permissionsParam}&projectKey=${projectKey}`
    : route`/rest/api/3/mypermissions?permissions=${permissionsParam}`;

  const response = await api.asUser().requestJira(endpoint, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  return response.json();
}

/**
 * Check if current user is a Jira administrator
 * @returns {Promise<boolean>} True if user is Jira admin
 */
export async function isJiraAdmin() {
  try {
    const permissions = await checkUserPermissions(['ADMINISTER']);
    return permissions.permissions?.ADMINISTER?.havePermission || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get all Jira projects accessible to the current user
 * Uses pagination to fetch ALL projects (Jira API returns max 50 per request)
 * @returns {Promise<Array<Object>>} Array of project objects with key and name
 */
export async function getAllJiraProjects() {
  try {
    const allProjects = [];
    let startAt = 0;
      const maxResults = 50;
    let hasMore = true;

    while (hasMore) {
      const response = await api.asUser().requestJira(
        route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      const data = await response.json();
      const projects = data.values || [];

      if (Array.isArray(projects) && projects.length > 0) {
        allProjects.push(...projects);
        startAt += projects.length;
        hasMore = data.isLast === false || (data.total && startAt < data.total);
      } else {
        hasMore = false;
      }

      // Safety limit to prevent infinite loops
      if (startAt > 1000) {
        console.warn('[getAllJiraProjects] Safety limit reached (1000 projects)');
        break;
      }
    }

    console.log(`[getAllJiraProjects] Fetched ${allProjects.length} total projects`);
    return allProjects.map(p => ({
      key: p.key,
      name: p.name
    }));
  } catch (error) {
    console.error('Error fetching Jira projects:', error);
    return [];
  }
}

/**
 * Get all Jira project keys accessible to the current user
 * @returns {Promise<Set<string>>} Set of project keys
 */
export async function getAllJiraProjectKeys() {
  const projects = await getAllJiraProjects();
  return new Set(projects.map(p => p.key));
}

/**
 * Get list of projects where current user is a Project Administrator
 * Uses action=edit parameter to filter projects where user has ADMINISTER_PROJECTS
 * or ADMINISTER (Jira Admin) permission - much faster than checking each project
 * @returns {Promise<Array<string>>} Array of project keys
 */
export async function getProjectsUserAdmins() {
  try {
    const adminProjects = [];
    let startAt = 0;
    const maxResults = 50;
    let hasMore = true;

    while (hasMore) {
      // action=edit returns only projects where user has Administer Projects
      // or Administer Jira permission - no need for separate permission checks
      const response = await api.asUser().requestJira(
        route`/rest/api/3/project/search?action=edit&startAt=${startAt}&maxResults=${maxResults}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      const data = await response.json();
      const projects = data.values || [];

      if (Array.isArray(projects) && projects.length > 0) {
        adminProjects.push(...projects.map(p => p.key));
        startAt += projects.length;
        hasMore = data.isLast === false || (data.total && startAt < data.total);
      } else {
        hasMore = false;
      }

      // Safety limit to prevent infinite loops
      if (startAt > 500) {
        console.warn('[getProjectsUserAdmins] Safety limit reached (500 projects)');
        break;
      }
    }

    console.log(`[getProjectsUserAdmins] Found ${adminProjects.length} admin projects`);
    return adminProjects;
  } catch (error) {
    console.error('Error getting user admin projects:', error);
    return [];
  }
}

/**
 * Format issue data for consistent output
 * @param {Object} issue - Raw Jira issue object
 * @returns {Object} Formatted issue object
 */
export function formatIssueData(issue) {
  return {
    key: issue.key,
    summary: issue.fields?.summary || '',
    status: issue.fields?.status?.name || 'Unknown',
    project: issue.fields?.project?.key || '',
    issueType: issue.fields?.issuetype?.name || 'Task',
    updated: issue.fields?.updated || issue.fields?.created
  };
}

/**
 * Format multiple issues
 * @param {Array<Object>} issues - Array of raw Jira issues
 * @returns {Array<Object>} Array of formatted issues
 */
export function formatIssuesData(issues) {
  return (issues || []).map(formatIssueData);
}

/**
 * Get available transitions for a Jira issue
 * @param {string} issueKey - Jira issue key (e.g., PROJ-123)
 * @returns {Promise<Array>} Array of available transitions
 */
export async function getIssueTransitions(issueKey) {
  const response = await api.asUser().requestJira(
    route`/rest/api/3/issue/${issueKey}/transitions`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }
  );

  const data = await response.json();
  return data.transitions || [];
}

/**
 * Transition a Jira issue to a new status
 * @param {string} issueKey - Jira issue key (e.g., PROJ-123)
 * @param {string} transitionId - Transition ID to execute
 * @returns {Promise<Object>} Transition response
 */
export async function transitionIssue(issueKey, transitionId) {
  const response = await api.asUser().requestJira(
    route`/rest/api/3/issue/${issueKey}/transitions`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transition: {
          id: transitionId
        }
      })
    }
  );

  if (response.status === 204) {
    // Success - 204 No Content is expected response
    return { success: true };
  }

  return response.json();
}
