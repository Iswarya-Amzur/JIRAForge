/**
 * User Resolvers
 * Resolver definitions for user information endpoints
 */

import { getCurrentUserInfo } from '../services/userService.js';
import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest } from '../utils/supabase.js';

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

  /**
   * Resolver for getting desktop app status
   * Checks if the user has the desktop app running and logged in
   */
  resolver.define('getDesktopAppStatus', async (req) => {
    const { accountId, cloudId } = req.context;

    try {
      const supabaseConfig = await getSupabaseConfig(accountId);
      if (!supabaseConfig) {
        // No Supabase config means user hasn't set up anything yet
        return {
          success: true,
          status: 'not-setup',
          showDownload: true,
          message: 'Download the Desktop App to start tracking your work'
        };
      }

      // Get organization
      const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
      if (!organization) {
        return {
          success: true,
          status: 'not-setup',
          showDownload: true,
          message: 'Download the Desktop App to start tracking your work'
        };
      }

      // Get user ID
      const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

      // Query user's desktop status
      const userResult = await supabaseRequest(
        supabaseConfig,
        `users?id=eq.${userId}&select=desktop_logged_in,desktop_last_heartbeat,desktop_app_version`
      );

      if (!userResult || userResult.length === 0) {
        return {
          success: true,
          status: 'not-setup',
          showDownload: true,
          message: 'Download the Desktop App to start tracking your work'
        };
      }

      const user = userResult[0];
      const { desktop_logged_in, desktop_last_heartbeat, desktop_app_version } = user;

      // Case 1: Never used desktop app (null values)
      if (desktop_logged_in === null || desktop_last_heartbeat === null) {
        return {
          success: true,
          status: 'not-setup',
          showDownload: true,
          message: 'Download the Desktop App to start tracking your work'
        };
      }

      // Case 2: Desktop app is logged in - check if heartbeat is recent (within 10 minutes)
      if (desktop_logged_in) {
        const lastHeartbeat = new Date(desktop_last_heartbeat);
        const minutesAgo = (Date.now() - lastHeartbeat.getTime()) / 60000;

        if (minutesAgo < 10) {
          // Active - desktop app is running
          return {
            success: true,
            status: 'active',
            showDownload: false,
            lastHeartbeat: desktop_last_heartbeat,
            appVersion: desktop_app_version
          };
        } else {
          // Heartbeat is stale - app might have crashed or connection lost
          return {
            success: true,
            status: 'inactive',
            showDownload: true,
            message: 'Desktop App seems inactive. Please check if it\'s running.',
            lastHeartbeat: desktop_last_heartbeat,
            appVersion: desktop_app_version
          };
        }
      }

      // Case 3: Desktop app is logged out
      return {
        success: true,
        status: 'logged-out',
        showDownload: true,
        message: 'Please open and log in to the Desktop App to continue tracking',
        lastHeartbeat: desktop_last_heartbeat,
        appVersion: desktop_app_version
      };

    } catch (error) {
      console.error('Error checking desktop app status:', error);
      return {
        success: false,
        error: error.message,
        status: 'error',
        showDownload: true,
        message: 'Unable to check Desktop App status'
      };
    }
  });
}
