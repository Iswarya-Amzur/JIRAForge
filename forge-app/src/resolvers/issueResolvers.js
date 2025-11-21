/**
 * Issue Resolvers
 * Resolver definitions for Jira issue operations endpoints
 */

import { getAssignedIssues, updateAssignedIssuesCache } from '../services/issueService.js';

/**
 * Register issue resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerIssueResolvers(resolver) {
  /**
   * Resolver for getting user's assigned Jira issues
   * Used by AI server to match screenshots to correct issues
   * Only returns issues with status "In Progress" or "In Review"
   */
  resolver.define('getUserAssignedIssues', async (req) => {
    const { context } = req;
    const accountId = context.accountId;

    try {
      const result = await getAssignedIssues(accountId);
      return {
        success: true,
        issues: result.issues,
        total: result.total
      };
    } catch (error) {
      console.error('Error fetching user assigned issues:', error);
      return {
        success: false,
        error: error.message,
        issues: []
      };
    }
  });

  /**
   * Resolver for updating user's assigned Jira issues cache in Supabase
   * This should be called periodically or on-demand to keep cache fresh
   */
  resolver.define('updateUserAssignedIssuesCache', async (req) => {
    const { context } = req;
    const accountId = context.accountId;

    try {
      const result = await updateAssignedIssuesCache(accountId);
      return {
        success: true,
        cached: result.cached,
        message: result.message
      };
    } catch (error) {
      console.error('Error updating user assigned issues cache:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
