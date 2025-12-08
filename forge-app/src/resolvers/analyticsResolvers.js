/**
 * Analytics Resolvers
 * Resolver definitions for time analytics endpoints
 */

import { fetchTimeAnalytics, fetchAllAnalytics, fetchProjectAnalytics, fetchProjectTeamAnalytics } from '../services/analyticsService.js';

/**
 * Register analytics resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerAnalyticsResolvers(resolver) {
  /**
   * Resolver for fetching time analytics data from Supabase
   */
  resolver.define('getTimeAnalytics', async (req) => {
    const { context } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      const data = await fetchTimeAnalytics(accountId, cloudId);
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error fetching time analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for fetching all analytics (Admin only)
   */
  resolver.define('getAllAnalytics', async (req) => {
    const { context } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      const data = await fetchAllAnalytics(accountId, cloudId);
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error fetching all analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for fetching project analytics (Project Manager only)
   */
  resolver.define('getProjectAnalytics', async (req) => {
    const { payload, context } = req;
    const { projectKey } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      const data = await fetchProjectAnalytics(accountId, cloudId, projectKey);
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error fetching project analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for fetching team analytics for a project (Project Admin only)
   * Returns aggregated team time tracking WITHOUT individual screenshots
   */
  resolver.define('getProjectTeamAnalytics', async (req) => {
    const { payload, context } = req;
    const { projectKey } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      const data = await fetchProjectTeamAnalytics(accountId, cloudId, projectKey);
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error fetching team analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
