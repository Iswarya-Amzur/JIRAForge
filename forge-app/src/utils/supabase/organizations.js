/**
 * Supabase Organization Utilities
 * Handles organization creation, lookup, and membership
 */

import { fetch } from '@forge/api';
import { getFromCache, setInCache, TTL, CacheKeys } from '../cache.js';

/**
 * Get or create organization record in Supabase
 * Uses caching to reduce database lookups (organizations rarely change)
 * @param {string} cloudId - Jira Cloud ID from Atlassian
 * @param {Object} supabaseConfig - Supabase configuration
 * @param {string} orgName - Optional organization name
 * @param {string} jiraUrl - Optional Jira instance URL
 * @returns {Promise<Object>} Organization object with id and other properties
 */
export async function getOrCreateOrganization(cloudId, supabaseConfig, orgName = null, jiraUrl = null) {
  const cacheKey = CacheKeys.organization(cloudId);

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // First, try to get organization by Jira Cloud ID
    const response = await fetch(
      `${supabaseConfig.url}/rest/v1/organizations?jira_cloud_id=eq.${cloudId}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.serviceRoleKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const orgs = await response.json();

    if (orgs && orgs.length > 0) {
      console.log('[Supabase] Found existing organization:', orgs[0].id);
      setInCache(cacheKey, orgs[0], TTL.ORGANIZATION);
      return orgs[0];
    }

    // Organization doesn't exist, create one
    const createResponse = await fetch(`${supabaseConfig.url}/rest/v1/organizations`, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        jira_cloud_id: cloudId,
        org_name: orgName || 'Unknown Organization',
        jira_instance_url: jiraUrl || `https://${cloudId}.atlassian.net`,
        subscription_status: 'active',
        subscription_tier: 'free'
      })
    });

    const newOrg = await createResponse.json();
    console.log('[Supabase] Created new organization:', newOrg[0].id);

    // Create default organization settings
    await fetch(`${supabaseConfig.url}/rest/v1/organization_settings`, {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organization_id: newOrg[0].id,
        screenshot_interval: 300,
        auto_worklog_enabled: true
      })
    });

    setInCache(cacheKey, newOrg[0], TTL.ORGANIZATION);

    return newOrg[0];
  } catch (error) {
    console.error('Error getting/creating organization:', error);
    throw error;
  }
}

/**
 * Ensure user has organization membership
 * @param {string} userId - User UUID
 * @param {string} organizationId - Organization UUID
 * @param {Object} supabaseConfig - Supabase configuration
 */
export async function ensureOrganizationMembership(userId, organizationId, supabaseConfig) {
  try {
    // Check if membership exists
    const response = await fetch(
      `${supabaseConfig.url}/rest/v1/organization_members?user_id=eq.${userId}&organization_id=eq.${organizationId}&select=id`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.serviceRoleKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const memberships = await response.json();

    if (!memberships || memberships.length === 0) {
      // Check if this is the first member (becomes owner)
      const countResponse = await fetch(
        `${supabaseConfig.url}/rest/v1/organization_members?organization_id=eq.${organizationId}&select=id`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.serviceRoleKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const existingMembers = await countResponse.json();
      const isFirstUser = !existingMembers || existingMembers.length === 0;
      const role = isFirstUser ? 'owner' : 'member';

      // Create membership
      await fetch(`${supabaseConfig.url}/rest/v1/organization_members`, {
        method: 'POST',
        headers: {
          'apikey': supabaseConfig.serviceRoleKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          organization_id: organizationId,
          role: role,
          can_manage_settings: ['owner', 'admin'].includes(role),
          can_view_team_analytics: ['owner', 'admin', 'manager'].includes(role),
          can_manage_members: ['owner', 'admin'].includes(role),
          can_delete_screenshots: ['owner', 'admin'].includes(role),
          can_manage_billing: role === 'owner'
        })
      });

      console.log('[Supabase] Created organization membership with role:', role);
    }
  } catch (error) {
    console.error('Error ensuring organization membership:', error);
  }
}

/**
 * Get user's organization membership and permissions
 * @param {string} userId - User UUID
 * @param {string} organizationId - Organization UUID
 * @param {Object} supabaseConfig - Supabase configuration
 * @returns {Promise<Object|null>} Membership object with role and permissions
 */
export async function getUserOrganizationMembership(userId, organizationId, supabaseConfig) {
  try {
    const response = await fetch(
      `${supabaseConfig.url}/rest/v1/organization_members?user_id=eq.${userId}&organization_id=eq.${organizationId}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.serviceRoleKey,
          'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const memberships = await response.json();
    return memberships && memberships.length > 0 ? memberships[0] : null;
  } catch (error) {
    console.error('Error getting organization membership:', error);
    return null;
  }
}
