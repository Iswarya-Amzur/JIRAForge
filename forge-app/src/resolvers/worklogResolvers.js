/**
 * Worklog Resolvers
 * Resolver definitions for Jira worklog creation endpoints
 */

import { createWorklog } from '../services/worklogService.js';

/**
 * Register worklog resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerWorklogResolvers(resolver) {
  /**
   * Resolver for creating worklog entries
   */
  resolver.define('createWorklog', async (req) => {
    const { payload } = req;
    const { issueKey, timeSpentSeconds, startedAt } = payload;

    try {
      const worklog = await createWorklog(issueKey, timeSpentSeconds, startedAt);
      return {
        success: true,
        worklog
      };
    } catch (error) {
      console.error('Error creating worklog:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
