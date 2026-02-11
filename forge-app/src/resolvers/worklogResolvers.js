/**
 * Worklog Resolvers
 * Resolver definitions for Jira worklog creation endpoints
 */

import { createWorklog } from '../services/worklogService.js';
import { runScheduledWorklogSync } from '../services/scheduledWorklogSync.js';
import { isJiraAdmin } from '../utils/jira.js';

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

  /**
   * Resolver to manually trigger worklog sync (admin only)
   */
  resolver.define('triggerWorklogSync', async () => {
    try {
      const isAdmin = await isJiraAdmin();
      if (!isAdmin) {
        return { success: false, error: 'Only Jira administrators can trigger worklog sync' };
      }

      const result = await runScheduledWorklogSync();
      return { success: true, ...result };
    } catch (error) {
      console.error('Error triggering worklog sync:', error);
      return { success: false, error: error.message };
    }
  });
}
