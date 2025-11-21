/**
 * Settings Resolvers
 * Resolver definitions for user settings endpoints
 */

import { getUserSettings, saveUserSettings } from '../services/settingsService.js';

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
}
