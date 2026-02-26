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
 * These can be project-level or organization-level settings for screenshot monitoring, app lists, etc.
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for multi-tenancy
 * @param {string} projectKey - Optional Jira project key for project-specific settings
 * @returns {Promise<Object>} Tracking settings with settingsSource indicating level
 */
export async function getTrackingSettings(accountId, cloudId, projectKey = null) {
  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      console.log('[TrackingSettings] Supabase not configured, returning defaults');
      return { ...DEFAULT_TRACKING_SETTINGS, settingsSource: 'default' };
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

    let response;
    let settingsSource = 'global';

    // Priority: project-specific → org-level → global defaults
    if (organizationId && projectKey) {
      // Try project-specific settings first
      response = await supabaseRequest(
        supabaseConfig,
        `tracking_settings?organization_id=eq.${organizationId}&project_key=eq.${projectKey}&limit=1`
      );
      if (response && response.length > 0) {
        settingsSource = 'project';
      }
    }

    // Fall back to org-level settings
    if (organizationId && (!response || response.length === 0)) {
      response = await supabaseRequest(
        supabaseConfig,
        `tracking_settings?organization_id=eq.${organizationId}&project_key=is.null&limit=1`
      );
      if (response && response.length > 0) {
        settingsSource = 'organization';
      }
    }

    // Fall back to global defaults
    if (!response || response.length === 0) {
      response = await supabaseRequest(
        supabaseConfig,
        'tracking_settings?organization_id=is.null&project_key=is.null&limit=1'
      );
      if (response && response.length > 0) {
        settingsSource = 'global';
      }
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
        privateSites: settings.private_sites || [],
        jiraWorklogSyncEnabled: settings.jira_worklog_sync_enabled ?? false,
        projectKey: settings.project_key || null,
        settingsSource: settingsSource
      };
    }

    return { ...DEFAULT_TRACKING_SETTINGS, settingsSource: 'default' };
  } catch (error) {
    console.error('[TrackingSettings] Error fetching settings:', error);
    return { ...DEFAULT_TRACKING_SETTINGS, settingsSource: 'default' };
  }
}

function inferPrivateMatchBy(identifier) {
  const value = (identifier || '').toLowerCase();
  // Process-like values (desktop executables / binaries)
  if (/\.(exe|app|bin|msc)$/i.test(value)) return 'process';
  // Wildcard/domain/path-like values are treated as URL entries.
  if (value.includes('*') || value.includes('/') || value.includes('.')) return 'url';
  // Safe default for legacy plain names in private list.
  return 'process';
}

function buildTrackingClassificationEntries({
  whitelistedApps = [],
  blacklistedApps = [],
  privateSites = []
} = {}) {
  const entries = [
    ...(whitelistedApps || []).filter(Boolean).map((identifier) => ({
      identifier,
      display_name: identifier,
      classification: 'productive',
      match_by: 'process'
    })),
    ...(blacklistedApps || []).filter(Boolean).map((identifier) => ({
      identifier,
      display_name: identifier,
      classification: 'non_productive',
      match_by: 'process'
    })),
    ...(privateSites || []).filter(Boolean).map((identifier) => ({
      identifier,
      display_name: identifier,
      classification: 'private',
      match_by: inferPrivateMatchBy(identifier)
    }))
  ];

  const uniqueMap = new Map();
  for (const entry of entries) {
    const key = `${entry.identifier}|${entry.match_by}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, entry);
  }
  return Array.from(uniqueMap.values());
}

async function deleteRemovedApplicationClassificationsFromTrackingSettings(
  supabaseConfig,
  {
    organizationId,
    projectKey,
    previousSettings = {},
    whitelistedApps = [],
    blacklistedApps = [],
    privateSites = []
  }
) {
  if (!organizationId) return;

  const previousEntries = buildTrackingClassificationEntries({
    whitelistedApps: previousSettings.whitelisted_apps || [],
    blacklistedApps: previousSettings.blacklisted_apps || [],
    privateSites: previousSettings.private_sites || []
  });
  const currentEntries = buildTrackingClassificationEntries({
    whitelistedApps,
    blacklistedApps,
    privateSites
  });
  const currentKeys = new Set(
    currentEntries.map((entry) => `${entry.identifier}|${entry.match_by}`)
  );
  const removedEntries = previousEntries.filter(
    (entry) => !currentKeys.has(`${entry.identifier}|${entry.match_by}`)
  );
  if (removedEntries.length === 0) return;

  const projectFilter = projectKey
    ? `project_key=eq.${encodeURIComponent(projectKey)}`
    : 'project_key=is.null';

  for (const entry of removedEntries) {
    await supabaseRequest(
      supabaseConfig,
      `application_classifications?organization_id=eq.${organizationId}&${projectFilter}&identifier=eq.${encodeURIComponent(entry.identifier)}&match_by=eq.${entry.match_by}`,
      { method: 'DELETE' }
    );
  }
}

async function upsertApplicationClassificationsFromTrackingSettings(
  supabaseConfig,
  {
    organizationId,
    projectKey,
    userId,
    whitelistedApps = [],
    blacklistedApps = [],
    privateSites = []
  }
) {
  if (!organizationId) {
    return;
  }

  const projectFilter = projectKey
    ? `project_key=eq.${encodeURIComponent(projectKey)}`
    : 'project_key=is.null';

  const uniqueEntries = buildTrackingClassificationEntries({
    whitelistedApps,
    blacklistedApps,
    privateSites
  });

  for (const entry of uniqueEntries) {
    const existing = await supabaseRequest(
      supabaseConfig,
      `application_classifications?organization_id=eq.${organizationId}&${projectFilter}&identifier=eq.${encodeURIComponent(entry.identifier)}&match_by=eq.${entry.match_by}&limit=1`
    );

    const payload = {
      organization_id: organizationId,
      project_key: projectKey || null,
      identifier: entry.identifier,
      display_name: entry.display_name,
      classification: entry.classification,
      match_by: entry.match_by,
      is_default: false,
      updated_at: new Date().toISOString(),
      created_by: userId || null
    };

    if (existing && existing.length > 0) {
      await supabaseRequest(
        supabaseConfig,
        `application_classifications?id=eq.${existing[0].id}`,
        { method: 'PATCH', body: payload }
      );
    } else {
      await supabaseRequest(
        supabaseConfig,
        'application_classifications',
        {
          method: 'POST',
          body: {
            ...payload,
            created_at: new Date().toISOString()
          }
        }
      );
    }

    // Backfill already-uploaded unknown activity rows for this app so values
    // don't remain stale after admin classification changes.
    try {
      const newStatus = entry.classification === 'productive' ? 'pending' : 'analyzed';
      let updateQuery =
        `activity_records?organization_id=eq.${organizationId}` +
        `&classification=eq.unknown` +
        `&application_name=eq.${encodeURIComponent(entry.identifier)}`;

      if (projectKey) {
        updateQuery += `&project_key=eq.${encodeURIComponent(projectKey)}`;
      }

      await supabaseRequest(
        supabaseConfig,
        updateQuery,
        {
          method: 'PATCH',
          body: {
            classification: entry.classification,
            status: newStatus
          }
        }
      );
    } catch (backfillErr) {
      console.warn(
        `[TrackingSettings] Classification saved for ${entry.identifier}, ` +
        `but failed to backfill unknown activity_records: ${backfillErr.message}`
      );
    }
  }
}

/**
 * Save tracking/timesheet settings to Supabase
 * Can save at project-level or organization-level
 * Only admins/project admins can save these settings
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for multi-tenancy
 * @param {Object} settings - Tracking settings object
 * @param {string} projectKey - Optional Jira project key for project-specific settings
 * @returns {Promise<void>}
 */
export async function saveTrackingSettings(accountId, cloudId, settings, projectKey = null) {
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
    project_key: projectKey || null,  // NULL for org-wide settings
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
    jira_worklog_sync_enabled: settings.jiraWorklogSyncEnabled ?? false,
    updated_by: userId,
    updated_at: new Date().toISOString()
  };

  // Check if settings already exist for this organization/project
  let existingSettings;
  if (organizationId && projectKey) {
    // Project-specific settings
    existingSettings = await supabaseRequest(
      supabaseConfig,
      `tracking_settings?organization_id=eq.${organizationId}&project_key=eq.${projectKey}&limit=1`
    );
  } else if (organizationId) {
    // Organization-level settings
    existingSettings = await supabaseRequest(
      supabaseConfig,
      `tracking_settings?organization_id=eq.${organizationId}&project_key=is.null&limit=1`
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

  // Keep application_classifications in sync with project/org app selections
  // saved in tracking settings so desktop project-level classification has rows.
  await deleteRemovedApplicationClassificationsFromTrackingSettings(
    supabaseConfig,
    {
      organizationId,
      projectKey,
      previousSettings: existingSettings?.[0] || {},
      whitelistedApps: trackingData.whitelisted_apps,
      blacklistedApps: trackingData.blacklisted_apps,
      privateSites: trackingData.private_sites
    }
  );

  await upsertApplicationClassificationsFromTrackingSettings(
    supabaseConfig,
    {
      organizationId,
      projectKey,
      userId,
      whitelistedApps: trackingData.whitelisted_apps,
      blacklistedApps: trackingData.blacklisted_apps,
      privateSites: trackingData.private_sites
    }
  );

  const settingsLevel = projectKey ? `project ${projectKey}` : `org ${organizationId}`;
  console.log(`[TrackingSettings] Settings saved successfully for ${settingsLevel}`);
}
