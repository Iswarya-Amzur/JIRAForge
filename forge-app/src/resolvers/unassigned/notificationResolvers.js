/**
 * Notification Resolvers for Unassigned Work
 * Handles notification settings and summary for desktop app reminders
 */

import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest } from '../../utils/supabase.js';

/**
 * Get notification settings for unassigned work reminders
 */
export async function getUnassignedNotificationSettings(req) {
  try {
    const { accountId, cloudId } = req.context;

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get or create organization first (multi-tenancy)
    const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
    if (!organization) {
      return { success: false, error: 'Unable to get organization information' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

    // Get user's settings from the users table
    const users = await supabaseRequest(
      supabaseConfig,
      `users?id=eq.${userId}&select=settings`
    );

    if (users && users.length > 0 && users[0].settings) {
      const settings = users[0].settings;
      return {
        success: true,
        settings: {
          unassignedWorkNotificationsEnabled: settings.unassigned_work_notifications_enabled ?? true,
          notificationIntervalHours: settings.notification_interval_hours ?? 4,
          minUnassignedMinutes: settings.min_unassigned_minutes ?? 30
        }
      };
    }

    // Return defaults
    return {
      success: true,
      settings: {
        unassignedWorkNotificationsEnabled: true,
        notificationIntervalHours: 4,
        minUnassignedMinutes: 30
      }
    };

  } catch (error) {
    console.error('Error getting notification settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save notification settings for unassigned work reminders
 */
export async function saveUnassignedNotificationSettings(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { settings } = req.payload;

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get or create organization first (multi-tenancy)
    const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
    if (!organization) {
      return { success: false, error: 'Unable to get organization information' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

    // Get current user settings
    const users = await supabaseRequest(
      supabaseConfig,
      `users?id=eq.${userId}&select=settings`
    );

    const currentSettings = (users && users.length > 0 && users[0].settings) ? users[0].settings : {};

    // Merge new notification settings into existing settings
    const updatedSettings = {
      ...currentSettings,
      unassigned_work_notifications_enabled: settings.unassignedWorkNotificationsEnabled ?? true,
      notification_interval_hours: settings.notificationIntervalHours ?? 4,
      min_unassigned_minutes: settings.minUnassignedMinutes ?? 30
    };

    // Update user settings
    await supabaseRequest(
      supabaseConfig,
      `users?id=eq.${userId}`,
      {
        method: 'PATCH',
        body: {
          settings: updatedSettings
        }
      }
    );

    return {
      success: true,
      message: 'Notification settings saved successfully'
    };

  } catch (error) {
    console.error('Error saving notification settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get unassigned work summary (for desktop app notifications)
 */
export async function getUnassignedWorkSummary(req) {
  try {
    const { accountId, cloudId } = req.context;

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get or create organization first (multi-tenancy)
    const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
    if (!organization) {
      return { success: false, error: 'Unable to get organization information' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

    // Get count of unassigned groups
    const groups = await supabaseRequest(
      supabaseConfig,
      `unassigned_work_groups?user_id=eq.${userId}&organization_id=eq.${organization.id}&is_assigned=eq.false&select=id,total_seconds`
    );

    const groupsArray = Array.isArray(groups) ? groups : (groups ? [groups] : []);
    const totalGroups = groupsArray.length;
    const totalSeconds = groupsArray.reduce((sum, g) => sum + (g.total_seconds || 0), 0);

    return {
      success: true,
      summary: {
        pendingGroups: totalGroups,
        totalUnassignedSeconds: totalSeconds,
        totalUnassignedMinutes: Math.round(totalSeconds / 60),
        totalUnassignedHours: Math.round(totalSeconds / 3600 * 10) / 10
      }
    };

  } catch (error) {
    console.error('Error getting unassigned work summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Register notification resolvers
 */
export function registerNotificationResolvers(resolver) {
  resolver.define('getUnassignedNotificationSettings', getUnassignedNotificationSettings);
  resolver.define('saveUnassignedNotificationSettings', saveUnassignedNotificationSettings);
  resolver.define('getUnassignedWorkSummary', getUnassignedWorkSummary);
}
