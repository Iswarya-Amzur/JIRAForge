/**
 * User Resolvers
 * Resolver definitions for user information endpoints
 */

import { getCurrentUserInfo } from '../services/userService.js';
import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest } from '../utils/supabase.js';
import { getLatestAppVersion } from '../utils/remote.js';

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
   * Also fetches latest version info for update notifications
   */
  resolver.define('getDesktopAppStatus', async (req) => {
    const { accountId, cloudId } = req.context;

    try {
      // Fetch latest app version info (cached for 5 minutes)
      let latestVersionInfo = null;
      try {
        latestVersionInfo = await getLatestAppVersion({ platform: 'windows' });
      } catch (versionError) {
        console.warn('Could not fetch latest app version:', versionError.message);
      }

      const supabaseConfig = await getSupabaseConfig(accountId);
      if (!supabaseConfig) {
        // No Supabase config means user hasn't set up anything yet
        return {
          success: true,
          status: 'not-setup',
          showDownload: true,
          message: 'Download the Desktop App to start tracking your work',
          // Include version info even for not-setup users
          latestVersion: latestVersionInfo?.latestVersion || null,
          downloadUrl: latestVersionInfo?.downloadUrl || null,
          releaseNotes: latestVersionInfo?.releaseNotes || null
        };
      }

      // Get organization
      const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
      if (!organization) {
        return {
          success: true,
          status: 'not-setup',
          showDownload: true,
          message: 'Download the Desktop App to start tracking your work',
          latestVersion: latestVersionInfo?.latestVersion || null,
          downloadUrl: latestVersionInfo?.downloadUrl || null,
          releaseNotes: latestVersionInfo?.releaseNotes || null
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
          message: 'Download the Desktop App to start tracking your work',
          latestVersion: latestVersionInfo?.latestVersion || null,
          downloadUrl: latestVersionInfo?.downloadUrl || null,
          releaseNotes: latestVersionInfo?.releaseNotes || null
        };
      }

      const user = userResult[0];
      const { desktop_logged_in, desktop_last_heartbeat, desktop_app_version } = user;

      // Check if update is available
      const updateAvailable = desktop_app_version && latestVersionInfo?.latestVersion
        ? isVersionNewer(latestVersionInfo.latestVersion, desktop_app_version)
        : false;

      // Case 1: Never used desktop app (null values)
      if (desktop_logged_in === null || desktop_last_heartbeat === null) {
        return {
          success: true,
          status: 'not-setup',
          showDownload: true,
          message: 'Download the Desktop App to start tracking your work',
          latestVersion: latestVersionInfo?.latestVersion || null,
          downloadUrl: latestVersionInfo?.downloadUrl || null,
          releaseNotes: latestVersionInfo?.releaseNotes || null
        };
      }

      // Case 2: Desktop app is logged in - check if heartbeat is recent (within 4.5 hours)
      if (desktop_logged_in) {
        const lastHeartbeat = new Date(desktop_last_heartbeat);
        const minutesAgo = (Date.now() - lastHeartbeat.getTime()) / 60000;

        if (minutesAgo < 270) {  // 4.5 hours = 270 minutes (gives buffer for 4-hour heartbeat)
          // Active - desktop app is running
          return {
            success: true,
            status: 'active',
            showDownload: false,
            lastHeartbeat: desktop_last_heartbeat,
            appVersion: desktop_app_version,
            // Update notification info
            updateAvailable,
            latestVersion: latestVersionInfo?.latestVersion || null,
            downloadUrl: latestVersionInfo?.downloadUrl || null,
            releaseNotes: latestVersionInfo?.releaseNotes || null,
            isMandatoryUpdate: latestVersionInfo?.isMandatory || false
          };
        } else {
          // Heartbeat is stale - app might have crashed or connection lost
          return {
            success: true,
            status: 'inactive',
            showDownload: true,
            message: 'Desktop App seems inactive. Please check if it\'s running.',
            lastHeartbeat: desktop_last_heartbeat,
            appVersion: desktop_app_version,
            updateAvailable,
            latestVersion: latestVersionInfo?.latestVersion || null,
            downloadUrl: latestVersionInfo?.downloadUrl || null,
            releaseNotes: latestVersionInfo?.releaseNotes || null,
            isMandatoryUpdate: latestVersionInfo?.isMandatory || false
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
        appVersion: desktop_app_version,
        updateAvailable,
        latestVersion: latestVersionInfo?.latestVersion || null,
        downloadUrl: latestVersionInfo?.downloadUrl || null,
        releaseNotes: latestVersionInfo?.releaseNotes || null,
        isMandatoryUpdate: latestVersionInfo?.isMandatory || false
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

/**
 * Compare two semantic versions
 * @param {string} v1 - Version to compare (latest)
 * @param {string} v2 - Version to compare against (current)
 * @returns {boolean} True if v1 is newer than v2
 */
function isVersionNewer(v1, v2) {
  if (!v1 || !v2) return false;
  
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  
  return false; // Versions are equal
}
