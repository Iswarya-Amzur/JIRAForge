/**
 * Settings Resolvers
 * Resolver definitions for user settings endpoints
 */

import { 
  getUserSettings, 
  saveUserSettings,
  getTrackingSettings,
  saveTrackingSettings
} from '../services/settingsService.js';

import {
  getJiraStatuses,
  getJiraProjects,
  getProjectSettings,
  getAllProjectSettings,
  saveProjectSettings,
  deleteProjectSettings
} from '../services/projectSettingsService.js';

/**
 * Register settings resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerSettingsResolvers(resolver) {
  /**
   * Resolver for getting user settings
   */
  resolver.define('getSettings', async (req) => {
    const { context } = req;
    const accountId = context.accountId;

    try {
      const settings = await getUserSettings(accountId);
      return {
        success: true,
        settings
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for saving user settings
   */
  resolver.define('saveSettings', async (req) => {
    const { payload, context } = req;
    const { settings } = payload;
    const accountId = context.accountId;

    try {
      await saveUserSettings(accountId, settings);
      return {
        success: true,
        message: 'Settings saved successfully'
      };
    } catch (error) {
      console.error('Error saving settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for getting tracking/timesheet settings
   * These settings control screenshot monitoring, whitelisted/blacklisted apps, etc.
   */
  resolver.define('getTrackingSettings', async (req) => {
    const { context } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      const settings = await getTrackingSettings(accountId, cloudId);
      return {
        success: true,
        settings
      };
    } catch (error) {
      console.error('Error getting tracking settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for saving tracking/timesheet settings
   * Only admins/project admins can save these settings
   */
  resolver.define('saveTrackingSettings', async (req) => {
    const { payload, context } = req;
    const { settings } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    try {
      await saveTrackingSettings(accountId, cloudId, settings);
      return {
        success: true,
        message: 'Tracking settings saved successfully'
      };
    } catch (error) {
      console.error('Error saving tracking settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================================================
  // PROJECT SETTINGS RESOLVERS (Tracked Statuses per Project)
  // ============================================================================

  /**
   * Resolver for getting all available Jira statuses
   * Used to populate the status selection UI
   */
  resolver.define('getJiraStatuses', async (req) => {
    try {
      const statuses = await getJiraStatuses();
      return {
        success: true,
        statuses
      };
    } catch (error) {
      console.error('Error getting Jira statuses:', error);
      return {
        success: false,
        error: error.message,
        statuses: []
      };
    }
  });

  /**
   * Resolver for getting all Jira projects
   * Used to show which projects have settings configured
   */
  resolver.define('getJiraProjects', async (req) => {
    try {
      const projects = await getJiraProjects();
      return {
        success: true,
        projects
      };
    } catch (error) {
      console.error('Error getting Jira projects:', error);
      return {
        success: false,
        error: error.message,
        projects: []
      };
    }
  });

  /**
   * Resolver for getting project settings (tracked statuses)
   */
  resolver.define('getProjectSettings', async (req) => {
    const { payload, context } = req;
    const { projectKey } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const settings = await getProjectSettings(projectKey, cloudId, accountId);
      return {
        success: true,
        settings
      };
    } catch (error) {
      console.error('Error getting project settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for getting all project settings in the organization
   */
  resolver.define('getAllProjectSettings', async (req) => {
    const { context } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const allSettings = await getAllProjectSettings(cloudId, accountId);
      return {
        success: true,
        projectSettings: allSettings
      };
    } catch (error) {
      console.error('Error getting all project settings:', error);
      return {
        success: false,
        error: error.message,
        projectSettings: []
      };
    }
  });

  /**
   * Resolver for saving project settings (tracked statuses)
   * Only project admins can save these settings
   */
  resolver.define('saveProjectSettings', async (req) => {
    const { payload, context } = req;
    const { projectKey, projectName, trackedStatuses } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const result = await saveProjectSettings(projectKey, projectName, trackedStatuses, cloudId, accountId);
      return {
        success: true,
        message: result.message,
        trackedStatuses: result.trackedStatuses
      };
    } catch (error) {
      console.error('Error saving project settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for deleting project settings
   * Resets project to use default status tracking
   */
  resolver.define('deleteProjectSettings', async (req) => {
    const { payload, context } = req;
    const { projectKey } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const result = await deleteProjectSettings(projectKey, cloudId, accountId);
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      console.error('Error deleting project settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
