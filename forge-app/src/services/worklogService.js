/**
 * Worklog Service
 * Business logic for creating Jira worklogs
 */

import { createJiraWorklog } from '../utils/jira.js';

/**
 * Create a worklog entry in Jira
 * @param {string} issueKey - Jira issue key (e.g., PROJ-123)
 * @param {number} timeSpentSeconds - Time spent in seconds
 * @param {string} startedAt - ISO timestamp when work started
 * @returns {Promise<Object>} Created worklog data
 */
export async function createWorklog(issueKey, timeSpentSeconds, startedAt) {
  return await createJiraWorklog(issueKey, timeSpentSeconds, startedAt);
}
