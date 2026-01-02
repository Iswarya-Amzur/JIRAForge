/**
 * Supabase User Utilities
 * Handles user creation and lookup
 */

import api, { fetch, route } from '@forge/api';
import { getFromCache, setInCache, TTL, CacheKeys } from '../cache.js';
import { ensureOrganizationMembership } from './organizations.js';

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
    console.log('[Supabase] Could not fetch Jira user details:', error.message);
  }
  return null;
}

/**
 * Get or create user record in Supabase with organization support
 * Uses caching to reduce database lookups (user IDs don't change)
 * @param {string} accountId - Atlassian account ID
 * @param {Object} supabaseConfig - Supabase configuration
 * @param {string} organizationId - Organization UUID (optional but recommended)
 * @returns {Promise<string>} Supabase user UUID
 */
export async function getOrCreateUser(accountId, supabaseConfig, organizationId = null) {
  const cacheKey = CacheKeys.userId(accountId);

  // Check cache first (only if we don't need to update org)
  const cached = getFromCache(cacheKey);
  if (cached && cached.organizationId === organizationId) {
    return cached.userId;
  }

  try {
    // First, try to get user by Atlassian account ID
    const response = await fetch(
      `${supabaseConfig.url}/rest/v1/users?atlassian_account_id=eq.${accountId}&select=id,organization_id`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.serviceRoleKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const users = await response.json();

    if (users && users.length > 0) {
      const userId = users[0].id;
      const existingOrgId = users[0].organization_id;

      // Update organization_id if provided and different
      if (organizationId && existingOrgId !== organizationId) {
        await fetch(`${supabaseConfig.url}/rest/v1/users?id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseConfig.serviceRoleKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organization_id: organizationId
          })
        });
        console.log('[Supabase] Updated user organization to:', organizationId);

        // Ensure organization membership exists
        await ensureOrganizationMembership(userId, organizationId, supabaseConfig);
      }

      // Check if user details need to be updated (email or display_name is null)
      const userDetailsResponse = await fetch(
        `${supabaseConfig.url}/rest/v1/users?id=eq.${userId}&select=email,display_name`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.serviceRoleKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const userDetails = await userDetailsResponse.json();

      if (userDetails && userDetails.length > 0 && (!userDetails[0].email || !userDetails[0].display_name)) {
        // Fetch details from Jira and update
        const jiraDetails = await fetchJiraUserDetails(accountId);
        if (jiraDetails && (jiraDetails.email || jiraDetails.displayName)) {
          await fetch(`${supabaseConfig.url}/rest/v1/users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseConfig.serviceRoleKey,
              'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: jiraDetails.email || userDetails[0].email,
              display_name: jiraDetails.displayName || userDetails[0].display_name,
              updated_at: new Date().toISOString()
            })
          });
          console.log('[Supabase] Updated user details for:', accountId);
        }
      }

      // Cache the user ID
      setInCache(cacheKey, { userId, organizationId: organizationId || existingOrgId }, TTL.USER_ID);

      return userId;
    }

    // User doesn't exist, create one
    // First fetch user details from Jira
    const jiraDetails = await fetchJiraUserDetails(accountId);

    const createResponse = await fetch(`${supabaseConfig.url}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        atlassian_account_id: accountId,
        organization_id: organizationId,
        email: jiraDetails?.email || null,
        display_name: jiraDetails?.displayName || null
      })
    });

    console.log('[Supabase] Created new user with details:', {
      accountId,
      email: jiraDetails?.email,
      displayName: jiraDetails?.displayName
    });

    const newUser = await createResponse.json();
    const newUserId = newUser[0].id;

    // Create organization membership if organization provided
    if (organizationId) {
      await ensureOrganizationMembership(newUserId, organizationId, supabaseConfig);
    }

    // Cache the new user ID
    setInCache(cacheKey, { userId: newUserId, organizationId }, TTL.USER_ID);

    return newUserId;
  } catch (error) {
    console.error('Error getting/creating user:', error);
    throw error;
  }
}
