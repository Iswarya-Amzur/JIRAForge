/**
 * User Resolvers
 * Resolver definitions for user information endpoints
 */

import { getCurrentUserInfo } from '../services/userService.js';

/**
 * Register user resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerUserResolvers(resolver) {
  /**
   * Resolver for getting current user's complete information
   * Similar to a /me endpoint - returns Jira profile + permissions
   */
  resolver.define('getCurrentUser', async (req) => {
    const { context } = req;
    const accountId = context.accountId;

    try {
      const userInfo = await getCurrentUserInfo(accountId);
      return {
        success: true,
        ...userInfo
      };
    } catch (error) {
      console.error('Error fetching current user:', error);
      return {
        success: false,
        error: error.message,
        user: null
      };
    }
  });
}
