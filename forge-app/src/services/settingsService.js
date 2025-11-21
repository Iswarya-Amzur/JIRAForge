/**
 * Settings Service
 * Business logic for user settings management
 */

import { storage } from '@forge/api';
import { DEFAULT_SETTINGS } from '../config/constants.js';

/**
 * Get user settings from Forge storage
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} User settings
 */
export async function getUserSettings(accountId) {
  const settings = await storage.get(`${accountId}:settings`);

  return settings || DEFAULT_SETTINGS;
}

/**
 * Save user settings to Forge storage
 * @param {string} accountId - Atlassian account ID
 * @param {Object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function saveUserSettings(accountId, settings) {
  // Validate required settings
  if (settings.supabaseUrl && !settings.supabaseUrl.startsWith('https://')) {
    throw new Error('Supabase URL must start with https://');
  }

  // Store settings in Forge storage
  await storage.set(`${accountId}:settings`, {
    supabaseUrl: settings.supabaseUrl || '',
    supabaseAnonKey: settings.supabaseAnonKey || '',
    supabaseServiceRoleKey: settings.supabaseServiceRoleKey || '',
    screenshotInterval: settings.screenshotInterval || DEFAULT_SETTINGS.screenshotInterval,
    autoWorklogEnabled: settings.autoWorklogEnabled !== undefined ? settings.autoWorklogEnabled : DEFAULT_SETTINGS.autoWorklogEnabled,
    aiServerUrl: settings.aiServerUrl || ''
  });
}
