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
  const jql = 'assignee = currentUser() ORDER BY updated DESC';

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
 * Get list of projects where current user is a Project Administrator
 * @returns {Promise<Array<string>>} Array of project keys
 */
export async function getProjectsUserAdmins() {
  try {
    // Get all projects accessible to the user
    const response = await api.asUser().requestJira(
      route`/rest/api/3/project`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    const projects = await response.json();
    const adminProjects = [];

    // Check ADMINISTER_PROJECTS permission for each project
    for (const project of projects) {
      try {
        const permissions = await checkUserPermissions(['ADMINISTER_PROJECTS'], project.key);
        if (permissions.permissions?.ADMINISTER_PROJECTS?.havePermission) {
          adminProjects.push(project.key);
        }
      } catch (error) {
        // If permission check fails for a project, skip it
        console.warn(`Could not check permissions for project ${project.key}:`, error.message);
      }
    }

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
