/**
 * Classification Resolvers
 * Resolver definitions for application classification management endpoints.
 * Follows the same pattern as settingsResolvers.js.
 */

import {
  getClassifications,
  saveClassification,
  deleteClassification,
  getUnknownApps,
  bulkImportClassifications
} from '../services/classificationService.js';

/**
 * Register classification resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerClassificationResolvers(resolver) {
  /**
   * Get all classifications for a project (merged: defaults + org + project overrides)
   */
  resolver.define('getClassifications', async (req) => {
    const { payload, context } = req;
    const { projectKey } = payload || {};
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const classifications = await getClassifications(projectKey, cloudId, accountId);
      return {
        success: true,
        classifications
      };
    } catch (error) {
      console.error('Error getting classifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Save (create or update) a single classification
   */
  resolver.define('saveClassification', async (req) => {
    const { payload, context } = req;
    const { classification, projectKey } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const result = await saveClassification(classification, projectKey, cloudId, accountId);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error saving classification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Delete a classification (org/project override only)
   */
  resolver.define('deleteClassification', async (req) => {
    const { payload, context } = req;
    const { classificationId } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const result = await deleteClassification(classificationId, cloudId, accountId);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error deleting classification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get unknown apps that need admin classification
   */
  resolver.define('getUnknownApps', async (req) => {
    const { context } = req;
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const unknownApps = await getUnknownApps(cloudId, accountId);
      return {
        success: true,
        unknownApps
      };
    } catch (error) {
      console.error('Error getting unknown apps:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Bulk import classifications
   */
  resolver.define('bulkImportClassifications', async (req) => {
    const { payload, context } = req;
    const { classifications, projectKey } = payload;
    const accountId = context.accountId;
    const cloudId = context.cloudId;

    try {
      const result = await bulkImportClassifications(classifications, projectKey, cloudId, accountId);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error bulk importing classifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
