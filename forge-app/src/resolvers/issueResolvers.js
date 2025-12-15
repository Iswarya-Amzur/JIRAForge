/**
 * Issue Resolvers
 * Resolver definitions for Jira issue operations endpoints
 */

import { getAssignedIssues, updateAssignedIssuesCache, getActiveIssuesWithTime, getAvailableTransitions, updateIssueStatus, reassignSession, getSessionScreenshots } from '../services/issueService.js';

/**
 * Register issue resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerIssueResolvers(resolver) {
  /**
   * Resolver for getting user's assigned Jira issues
   * Used by AI server to match screenshots to correct issues
   * Only returns issues with status "In Progress"
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
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      const result = await updateAssignedIssuesCache(accountId, cloudId);
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

  /**
   * Resolver for getting user's active issues with time tracking data
   * Returns assigned issues enriched with time tracking from Supabase
   */
  resolver.define('getActiveIssuesWithTime', async (req) => {
    const { context } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      const result = await getActiveIssuesWithTime(accountId, cloudId);
      return {
        success: true,
        issues: result.issues,
        total: result.total
      };
    } catch (error) {
      console.error('Error fetching active issues with time:', error);
      return {
        success: false,
        error: error.message,
        issues: [],
        total: 0
      };
    }
  });

  /**
   * Resolver for getting available status transitions for an issue
   * Returns list of available status transitions user can make
   */
  resolver.define('getIssueTransitions', async (req) => {
    const { payload } = req;
    const { issueKey } = payload;

    if (!issueKey) {
      return {
        success: false,
        error: 'Issue key is required',
        transitions: []
      };
    }

    try {
      const transitions = await getAvailableTransitions(issueKey);
      return {
        success: true,
        issueKey,
        transitions
      };
    } catch (error) {
      console.error(`Error getting transitions for ${issueKey}:`, error);
      return {
        success: false,
        error: error.message,
        transitions: []
      };
    }
  });

  /**
   * Resolver for updating issue status
   * Transitions issue to new status via Jira API
   */
  resolver.define('updateIssueStatus', async (req) => {
    const { payload } = req;
    const { issueKey, transitionId } = payload;

    if (!issueKey || !transitionId) {
      return {
        success: false,
        error: 'Issue key and transition ID are required'
      };
    }

    try {
      const result = await updateIssueStatus(issueKey, transitionId);
      return {
        success: true,
        issueKey,
        message: result.message
      };
    } catch (error) {
      console.error(`Error updating status for ${issueKey}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for reassigning a work session from one issue to another
   * Updates analysis_results records in Supabase
   */
  resolver.define('reassignSession', async (req) => {
    const { context, payload } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;
    const { analysisResultIds, fromIssueKey, toIssueKey, totalSeconds } = payload;

    if (!analysisResultIds || !Array.isArray(analysisResultIds) || analysisResultIds.length === 0) {
      return {
        success: false,
        error: 'No analysis results to reassign'
      };
    }

    if (!fromIssueKey || !toIssueKey) {
      return {
        success: false,
        error: 'Both fromIssueKey and toIssueKey are required'
      };
    }

    if (fromIssueKey === toIssueKey) {
      return {
        success: false,
        error: 'Cannot reassign to the same issue'
      };
    }

    try {
      const result = await reassignSession(
        accountId,
        cloudId,
        analysisResultIds,
        fromIssueKey,
        toIssueKey,
        totalSeconds || 0
      );
      return {
        success: true,
        reassigned: result.reassigned,
        errors: result.errors,
        message: result.message
      };
    } catch (error) {
      console.error(`Error reassigning session from ${fromIssueKey} to ${toIssueKey}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for getting screenshots for a work session
   * Fetches screenshots with signed URLs for verification
   */
  resolver.define('getSessionScreenshots', async (req) => {
    const { context, payload } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;
    const { analysisResultIds } = payload;

    console.log(`[getSessionScreenshots] Received ${analysisResultIds?.length || 0} analysis result IDs`);

    if (!analysisResultIds || !Array.isArray(analysisResultIds) || analysisResultIds.length === 0) {
      return {
        success: false,
        error: 'No analysis result IDs provided'
      };
    }

    try {
      const result = await getSessionScreenshots(accountId, cloudId, analysisResultIds);
      return {
        success: true,
        screenshots: result.screenshots
      };
    } catch (error) {
      console.error('Error getting session screenshots:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
