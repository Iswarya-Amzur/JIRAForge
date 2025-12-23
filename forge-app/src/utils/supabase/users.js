/**
 * Supabase User Utilities
 * Handles user creation and lookup
 */

import { fetch } from '@forge/api';
import { getFromCache, setInCache, TTL, CacheKeys } from '../cache.js';
import { ensureOrganizationMembership } from './organizations.js';

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

      // Cache the user ID
      setInCache(cacheKey, { userId, organizationId: organizationId || existingOrgId }, TTL.USER_ID);

      return userId;
    }

    // User doesn't exist, create one
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
        organization_id: organizationId
      })
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
