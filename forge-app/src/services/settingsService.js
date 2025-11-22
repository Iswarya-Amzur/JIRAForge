/**
 * Settings Service
 * Business logic for user settings management
 */

import { storage } from '@forge/api';
import { isJiraAdmin } from '../utils/jira.js';
import { DEFAULT_SETTINGS } from '../config/constants.js';

/**
 * Get user settings from Forge storage
 * Note: We now use a global key so settings apply to all users
 * @param {string} accountId - Atlassian account ID (ignored for global settings)
 * @returns {Promise<Object>} User settings
 */
export async function getUserSettings(accountId) {
  // Use a global key instead of account-specific key
  const settings = await storage.get('global:app-settings');

  return settings || DEFAULT_SETTINGS;
}

/**
 * Save user settings to Forge storage
 * Note: We now use a global key so settings apply to all users
 * IMPORTANT: Only Jira Administrators can save global settings
 * @param {string} accountId - Atlassian account ID (ignored for global settings)
 * @param {Object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function saveUserSettings(accountId, settings) {
  // Check if user is Jira Administrator
  const isAdmin = await isJiraAdmin();
  if (!isAdmin) {
    throw new Error('Access denied: Only Jira Administrators can configure global settings');
  }

  // Validate required settings
  if (settings.supabaseUrl && !settings.supabaseUrl.startsWith('https://')) {
    throw new Error('Supabase URL must start with https://');
  }

  if (settings.aiServerUrl && !settings.aiServerUrl.startsWith('http://') && !settings.aiServerUrl.startsWith('https://')) {
    throw new Error('AI Server URL must start with http:// or https://');
  }

  // Store settings in global Forge storage
  await storage.set('global:app-settings', {
    supabaseUrl: settings.supabaseUrl || '',
    supabaseAnonKey: settings.supabaseAnonKey || '',
    supabaseServiceRoleKey: settings.supabaseServiceRoleKey || '',
    aiServerUrl: settings.aiServerUrl || '',
    aiServerApiKey: settings.aiServerApiKey || '',
    screenshotInterval: settings.screenshotInterval || DEFAULT_SETTINGS.screenshotInterval,
    autoWorklogEnabled: settings.autoWorklogEnabled !== undefined ? settings.autoWorklogEnabled : DEFAULT_SETTINGS.autoWorklogEnabled
  });
}
