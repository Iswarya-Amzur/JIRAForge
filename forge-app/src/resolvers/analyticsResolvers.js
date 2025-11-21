/**
 * Analytics Resolvers
 * Resolver definitions for time analytics endpoints
 */

import { fetchTimeAnalytics } from '../services/analyticsService.js';

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

    try {
      const data = await fetchTimeAnalytics(accountId);
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
}
