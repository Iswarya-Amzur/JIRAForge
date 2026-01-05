/**
 * Supabase Organization Utilities
 * Handles organization creation, lookup, and membership
 *
 * NOTE: These functions now route through the AI server via Forge Remote.
 * The supabaseConfig parameter is kept for backward compatibility but is ignored.
 */

import {
  getOrCreateOrganization as remoteGetOrCreateOrganization,
  getOrganizationMembership as remoteGetOrganizationMembership
} from '../remote.js';

/**
 * Get or create organization record in Supabase
 * @param {string} cloudId - Jira Cloud ID from Atlassian
 * @param {Object} supabaseConfig - DEPRECATED: Ignored, kept for backward compatibility
 * @param {string} orgName - Optional organization name
 * @param {string} jiraUrl - Optional Jira instance URL
 * @returns {Promise<Object>} Organization object with id and other properties
 */
export async function getOrCreateOrganization(cloudId, supabaseConfig, orgName = null, jiraUrl = null) {
  // supabaseConfig is ignored - credentials are managed by the AI server
  return remoteGetOrCreateOrganization(cloudId, orgName, jiraUrl);
}

/**
 * Ensure user has organization membership
 * NOTE: This is now handled automatically by the AI server when creating/updating users
 * @param {string} userId - User UUID
 * @param {string} organizationId - Organization UUID
 * @param {Object} supabaseConfig - DEPRECATED: Ignored
 */
export async function ensureOrganizationMembership(userId, organizationId, supabaseConfig) {
  // This is now handled automatically by the AI server
  // when getOrCreateUser is called with an organizationId
  console.log('[Organizations] ensureOrganizationMembership is now handled by AI server');
}

/**
 * Get user's organization membership and permissions
 * @param {string} userId - User UUID
 * @param {string} organizationId - Organization UUID
 * @param {Object} supabaseConfig - DEPRECATED: Ignored
 * @returns {Promise<Object|null>} Membership object with role and permissions
 */
export async function getUserOrganizationMembership(userId, organizationId, supabaseConfig) {
  // supabaseConfig is ignored - credentials are managed by the AI server
  return remoteGetOrganizationMembership(userId, organizationId);
}
