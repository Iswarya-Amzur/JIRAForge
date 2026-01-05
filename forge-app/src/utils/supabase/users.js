/**
 * Supabase User Utilities
 * Handles user creation and lookup
 *
 * NOTE: These functions now route through the AI server via Forge Remote.
 * The supabaseConfig parameter is kept for backward compatibility but is ignored.
 */

import api, { route } from '@forge/api';
import { getOrCreateUser as remoteGetOrCreateUser } from '../remote.js';

/**
 * Fetch user details from Jira API
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object|null>} User details or null if failed
 */
async function fetchJiraUserDetails(accountId) {
  try {
    const response = await api.asUser().requestJira(
      route`/rest/api/3/user?accountId=${accountId}`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const user = await response.json();
      return {
        email: user.emailAddress || null,
        displayName: user.displayName || null
      };
    }
  } catch (error) {
    console.log('[Users] Could not fetch Jira user details:', error.message);
  }
  return null;
}

/**
 * Get or create user record in Supabase with organization support
 * @param {string} accountId - Atlassian account ID
 * @param {Object} supabaseConfig - DEPRECATED: Ignored, kept for backward compatibility
 * @param {string} organizationId - Organization UUID (optional but recommended)
 * @returns {Promise<string>} Supabase user UUID
 */
export async function getOrCreateUser(accountId, supabaseConfig, organizationId = null) {
  try {
    // Fetch Jira user details to pass to the AI server
    const jiraDetails = await fetchJiraUserDetails(accountId);

    // Call remote function - supabaseConfig is ignored
    const userId = await remoteGetOrCreateUser(
      accountId,
      organizationId,
      jiraDetails?.email,
      jiraDetails?.displayName
    );

    return userId;
  } catch (error) {
    console.error('[Users] Error getting/creating user:', error);
    throw error;
  }
}
