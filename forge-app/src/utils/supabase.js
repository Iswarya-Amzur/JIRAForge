/**
 * Supabase utility functions
 * All Supabase-related operations should go through these helpers
 */

import { fetch, storage } from '@forge/api';
import { getFromCache, setInCache, TTL, CacheKeys } from './cache.js';

/**
 * Get Supabase client configuration from Forge storage
 * Uses caching to reduce storage reads
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object|null>} Supabase configuration or null if not configured
 */
export async function getSupabaseConfig(accountId) {
  const cacheKey = CacheKeys.supabaseConfig(accountId);
  
  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const settings = await storage.get('global:app-settings');
    if (!settings) {
      return null;
    }
    const config = {
      url: settings.supabaseUrl,
      serviceRoleKey: settings.supabaseServiceRoleKey,
      anonKey: settings.supabaseAnonKey
    };
    
    // Cache the config
    setInCache(cacheKey, config, TTL.CONFIG);
    
    return config;
  } catch (error) {
    console.error('Error getting Supabase config:', error);
    return null;
  }
}

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
      // Cache the organization
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

    // Cache the new organization
    setInCache(cacheKey, newOrg[0], TTL.ORGANIZATION);
    
    return newOrg[0];
  } catch (error) {
    console.error('Error getting/creating organization:', error);
    throw error;
  }
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

/**
 * Ensure user has organization membership
 * @param {string} userId - User UUID
 * @param {string} organizationId - Organization UUID
 * @param {Object} supabaseConfig - Supabase configuration
 */
async function ensureOrganizationMembership(userId, organizationId, supabaseConfig) {
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

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a request to Supabase REST API with retry logic for rate limiting
 * @param {Object} supabaseConfig - Supabase configuration
 * @param {string} endpoint - API endpoint (e.g., 'screenshots', 'users?id=eq.123')
 * @param {Object} options - Request options (method, body, headers)
 * @param {number} retryCount - Current retry attempt (internal)
 * @returns {Promise<Object>} Response data
 */
export async function supabaseRequest(supabaseConfig, endpoint, options = {}, retryCount = 0) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000; // 1 second base delay
  
  const url = `${supabaseConfig.url}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': supabaseConfig.serviceRoleKey,
    'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  // Handle rate limiting with exponential backoff
  if (response.status === 429) {
    if (retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff: 1s, 2s, 4s
      console.warn(`[Supabase] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return supabaseRequest(supabaseConfig, endpoint, options, retryCount + 1);
    }
    throw new Error('Supabase request failed: Too Many Requests');
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase request failed: ${error}`);
  }

  // Handle empty responses (204 No Content) from PATCH/DELETE operations
  if (response.status === 204) {
    // 204 No Content - return empty array for PATCH operations that need data
    return options.method === 'PATCH' ? [] : null;
  }

  // Check content-type before parsing
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  // Handle empty responses
  if (!text || text.trim() === '') {
    return options.method === 'PATCH' ? [] : null;
  }

  // Parse JSON response
  try {
    return JSON.parse(text);
  } catch (parseError) {
    console.error('Failed to parse JSON response:', {
      status: response.status,
      contentType,
      text: text.substring(0, 200),
      url
    });
    throw new Error(`Invalid JSON response from Supabase: ${text.substring(0, 100)}`);
  }
}

/**
 * Upload file to Supabase Storage
 * @param {Object} supabaseConfig - Supabase configuration
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in storage
 * @param {Uint8Array|Buffer} data - File data
 * @param {string} contentType - MIME type
 * @returns {Promise<Object>} Upload response
 */
export async function uploadToSupabaseStorage(supabaseConfig, bucket, path, data, contentType) {
  const uploadResponse = await fetch(
    `${supabaseConfig.url}/storage/v1/object/${bucket}/${path}`,
    {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: data
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload file: ${error}`);
  }

  return uploadResponse.json();
}

/**
 * Generate signed URL for private storage file
 * @param {Object} supabaseConfig - Supabase configuration
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in storage
 * @param {number} expiresIn - URL expiry time in seconds
 * @returns {Promise<string>} Signed URL
 */
export async function generateSignedUrl(supabaseConfig, bucket, path, expiresIn = 3600) {
  // Don't encode the entire path - Supabase expects slashes to be unencoded
  // Only encode individual path segments if needed
  const signedUrlResponse = await fetch(
    `${supabaseConfig.url}/storage/v1/object/sign/${bucket}/${path}`,
    {
      method: 'POST',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expiresIn
      })
    }
  );

  if (!signedUrlResponse.ok) {
    const errorText = await signedUrlResponse.text();
    console.error('Signed URL generation failed:', errorText);
    throw new Error(`Failed to generate signed URL: ${errorText}`);
  }

  const signedData = await signedUrlResponse.json();

  // Supabase returns signedURL as a path, need to prepend the base URL
  if (signedData.signedURL) {
    // Check if the path already includes /storage/v1
    const signedPath = signedData.signedURL.startsWith('/storage/v1')
      ? signedData.signedURL
      : `/storage/v1${signedData.signedURL}`;
    return `${supabaseConfig.url}${signedPath}`;
  } else if (signedData.url) {
    return signedData.url;
  }

  console.error('No signed URL in response:', signedData);
  throw new Error('No signed URL in response');
}

/**
 * Delete file from Supabase Storage
 * @param {Object} supabaseConfig - Supabase configuration
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in storage
 * @returns {Promise<void>}
 */
export async function deleteFromSupabaseStorage(supabaseConfig, bucket, path) {
  const deleteResponse = await fetch(
    `${supabaseConfig.url}/storage/v1/object/${bucket}/${path}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
      }
    }
  );

  if (!deleteResponse.ok) {
    const error = await deleteResponse.text();
    throw new Error(`Failed to delete file: ${error}`);
  }
}
