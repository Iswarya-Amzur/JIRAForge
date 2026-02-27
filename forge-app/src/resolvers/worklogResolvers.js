/**
 * Worklog Resolvers
 * Resolver definitions for Jira worklog creation endpoints
 */

import { createWorklog, syncCurrentUserWorklogs } from '../services/worklogService.js';
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
   * Sync worklogs for the CURRENT USER in their live Jira session.
   *
   * Uses api.asUser() with no accountId arg, so Jira records the worklog
   * author as the actual user (not the app).  Any existing worklogs that
   * were previously created by the app are deleted and recreated under the
   * user's real name.
   *
   * Called automatically when the user opens the project page (with a
   * 15-minute client-side cooldown to avoid excessive calls).
   */
  resolver.define('syncMyWorklogs', async (req) => {
    const { accountId, cloudId } = req.context;
    try {
      return await syncCurrentUserWorklogs(accountId, cloudId);
    } catch (error) {
      console.error('[WorklogResolver] syncMyWorklogs error:', error);
      return { success: false, error: error.message };
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
