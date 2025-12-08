/**
 * Screenshot Resolvers
 * Resolver definitions for screenshot management endpoints
 */

import { fetchScreenshots, deleteScreenshot } from '../services/screenshotService.js';

/**
 * Register screenshot resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerScreenshotResolvers(resolver) {
  /**
   * Resolver for fetching screenshots for a user
   */
  resolver.define('getScreenshots', async (req) => {
    const { context, payload } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context
    const { limit = 50, offset = 0 } = payload || {};

    try {
      const data = await fetchScreenshots(accountId, cloudId, limit, offset);
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error fetching screenshots:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for deleting a screenshot
   */
  resolver.define('deleteScreenshot', async (req) => {
    const { payload, context } = req;
    const { screenshotId } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      await deleteScreenshot(accountId, cloudId, screenshotId);
      return {
        success: true,
        message: 'Screenshot deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting screenshot:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
