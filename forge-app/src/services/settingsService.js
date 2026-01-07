/**
 * Settings Service
 * Business logic for user settings management
 *
 * Note: AI server connection settings have been removed.
 * All connections are now managed automatically via Forge Remote (manifest.yml).
 */

import { isJiraAdmin, checkUserPermissions } from '../utils/jira.js';
import { getSupabaseConfig, supabaseRequest, getOrCreateOrganization, getOrCreateUser } from '../utils/supabase.js';
import { DEFAULT_TRACKING_SETTINGS } from '../config/constants.js';

/**
 * Get user settings from Forge storage
 * Note: AI server settings have been removed - connections are now automatic via Forge Remote
 * @param {string} accountId - Atlassian account ID (ignored)
 * @returns {Promise<Object>} User settings
 */
export async function getUserSettings(accountId) {
  // All connections are now managed automatically via Forge Remote
  // No user-configurable settings required
  return {
    configured: true,
    connectionMode: 'forge-remote'
  };
}

/**
 * Save user settings to Forge storage
 * Note: AI server settings have been removed - connections are now automatic via Forge Remote
 * This function is kept for backward compatibility but no longer stores AI server settings
 * @param {string} accountId - Atlassian account ID (ignored)
 * @param {Object} settings - Settings object (ignored)
 * @returns {Promise<void>}
 */
export async function saveUserSettings(accountId, settings) {
  // Check if user is Jira Administrator
  const isAdmin = await isJiraAdmin();
  if (!isAdmin) {
    throw new Error('Access denied: Only Jira Administrators can access settings');
  }

  // No settings to save - AI server connection is managed via Forge Remote in manifest.yml
  // This function is kept for backward compatibility
  return;
}

/**
 * Get tracking/timesheet settings from Supabase
 * These are organization-level settings for screenshot monitoring, app lists, etc.
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for multi-tenancy
 * @returns {Promise<Object>} Tracking settings
 */
export async function getTrackingSettings(accountId, cloudId) {
  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      console.log('[TrackingSettings] Supabase not configured, returning defaults');
      return DEFAULT_TRACKING_SETTINGS;
    }

    // Get organization for multi-tenancy
    let organizationId = null;
    if (cloudId) {
      try {
        const org = await getOrCreateOrganization(cloudId, supabaseConfig);
        organizationId = org?.id;
      } catch (err) {
        console.log('[TrackingSettings] Could not get organization, using global settings');
      }
    }

    // Try to get org-specific settings first, then fall back to global (organization_id = NULL)
    let response;
    if (organizationId) {
      response = await supabaseRequest(
        supabaseConfig,
        `tracking_settings?organization_id=eq.${organizationId}&limit=1`
      );
    }

    // If no org-specific settings, get global defaults
    if (!response || response.length === 0) {
      response = await supabaseRequest(
        supabaseConfig,
        'tracking_settings?organization_id=is.null&limit=1'
      );
    }

    if (response && response.length > 0) {
      const settings = response[0];
      return {
        screenshotMonitoringEnabled: settings.screenshot_monitoring_enabled,
        screenshotIntervalSeconds: settings.screenshot_interval_seconds,
        intervalTrackingEnabled: settings.interval_tracking_enabled ?? (settings.tracking_mode === 'interval'),
        eventTrackingEnabled: settings.event_tracking_enabled,
        trackWindowChanges: settings.track_window_changes,
        trackIdleTime: settings.track_idle_time,
        idleThresholdSeconds: settings.idle_threshold_seconds,
        whitelistEnabled: settings.whitelist_enabled,
        whitelistedApps: settings.whitelisted_apps || [],
        blacklistEnabled: settings.blacklist_enabled,
        blacklistedApps: settings.blacklisted_apps || [],
        nonWorkThresholdPercent: settings.non_work_threshold_percent,
        flagExcessiveNonWork: settings.flag_excessive_non_work,
        privateSitesEnabled: settings.private_sites_enabled,
        privateSites: settings.private_sites || []
      };
    }

    return DEFAULT_TRACKING_SETTINGS;
  } catch (error) {
    console.error('[TrackingSettings] Error fetching settings:', error);
    return DEFAULT_TRACKING_SETTINGS;
  }
}

/**
 * Save tracking/timesheet settings to Supabase
 * Only admins/project admins can save these settings
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for multi-tenancy
 * @param {Object} settings - Tracking settings object
 * @returns {Promise<void>}
 */
export async function saveTrackingSettings(accountId, cloudId, settings) {
  // Check if user is Jira Administrator or Project Admin
  const isAdmin = await isJiraAdmin();
  const permissions = await checkUserPermissions(['ADMINISTER_PROJECTS']);
  const isProjectAdmin = permissions.permissions?.ADMINISTER_PROJECTS?.havePermission;

  if (!isAdmin && !isProjectAdmin) {
    throw new Error('Access denied: Only Jira Administrators or Project Administrators can configure tracking settings');
  }

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings first.');
  }

  // Validate settings
  if (settings.screenshotIntervalSeconds < 60 || settings.screenshotIntervalSeconds > 3600) {
    throw new Error('Screenshot interval must be between 60 and 3600 seconds');
  }

  if (settings.nonWorkThresholdPercent < 0 || settings.nonWorkThresholdPercent > 100) {
    throw new Error('Non-work threshold must be between 0 and 100 percent');
  }

  // Get organization and user IDs for multi-tenancy
  let organizationId = null;
  let userId = null;
  
  if (cloudId) {
    try {
      const org = await getOrCreateOrganization(cloudId, supabaseConfig);
      organizationId = org?.id;
    } catch (err) {
      console.log('[TrackingSettings] Could not get organization:', err.message);
    }
  }

  if (accountId) {
    try {
      userId = await getOrCreateUser(accountId, supabaseConfig, organizationId);
    } catch (err) {
      console.log('[TrackingSettings] Could not get user:', err.message);
    }
  }

  // Prepare data for Supabase
  const trackingData = {
    organization_id: organizationId,
    screenshot_monitoring_enabled: settings.screenshotMonitoringEnabled,
    screenshot_interval_seconds: settings.screenshotIntervalSeconds,
    tracking_mode: settings.intervalTrackingEnabled ? 'interval' : 'event',
    event_tracking_enabled: settings.eventTrackingEnabled,
    track_window_changes: settings.trackWindowChanges,
    track_idle_time: settings.trackIdleTime,
    idle_threshold_seconds: settings.idleThresholdSeconds,
    whitelist_enabled: settings.whitelistEnabled,
    whitelisted_apps: settings.whitelistedApps || [],
    blacklist_enabled: settings.blacklistEnabled,
    blacklisted_apps: settings.blacklistedApps || [],
    non_work_threshold_percent: settings.nonWorkThresholdPercent,
    flag_excessive_non_work: settings.flagExcessiveNonWork,
    private_sites_enabled: settings.privateSitesEnabled,
    private_sites: settings.privateSites || [],
    updated_by: userId,
    updated_at: new Date().toISOString()
  };

  // Check if settings already exist for this organization
  let existingSettings;
  if (organizationId) {
    existingSettings = await supabaseRequest(
      supabaseConfig,
      `tracking_settings?organization_id=eq.${organizationId}&limit=1`
    );
  } else {
    existingSettings = await supabaseRequest(
      supabaseConfig,
      'tracking_settings?organization_id=is.null&limit=1'
    );
  }

  if (existingSettings && existingSettings.length > 0) {
    // Update existing settings
    const settingsId = existingSettings[0].id;
    await supabaseRequest(
      supabaseConfig,
      `tracking_settings?id=eq.${settingsId}`,
      { method: 'PATCH', body: trackingData }
    );
  } else {
    // Insert new settings
    trackingData.created_by = userId;
    trackingData.created_at = new Date().toISOString();
    await supabaseRequest(
      supabaseConfig,
      'tracking_settings',
      { method: 'POST', body: trackingData }
    );
  }

  console.log('[TrackingSettings] Settings saved successfully for org:', organizationId);
}
