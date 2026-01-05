/**
 * Remote API Utility
 * Handles all communication with the AI server via Forge Remote
 * The AI server handles Supabase operations securely without exposing credentials
 */

import { fetch } from '@forge/api';
import { getFromCache, setInCache, TTL, CacheKeys } from './cache.js';

// AI Server base URL (configured in manifest.yml as remote)
const AI_SERVER_REMOTE = 'remote:ai-server';

/**
 * Make a request to the AI server via Forge Remote
 * Forge automatically adds the FIT token for authentication
 * @param {string} endpoint - API endpoint path (e.g., '/api/forge/organization')
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response data
 */
async function remoteRequest(endpoint, options = {}) {
  const url = `${AI_SERVER_REMOTE}${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Remote] Request failed: ${response.status}`, errorText);
    throw new Error(`Remote request failed: ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Unknown error from remote');
  }

  return result.data;
}

/**
 * Execute a Supabase query via the AI server
 * @param {string} table - Table name
 * @param {Object} options - Query options (method, query, body, select)
 * @returns {Promise<Object>} Query result
 */
export async function supabaseQuery(table, options = {}) {
  return remoteRequest('/api/forge/supabase/query', {
    body: {
      table,
      method: options.method || 'GET',
      query: options.query,
      body: options.body,
      select: options.select
    }
  });
}

/**
 * Get or create organization by Jira Cloud ID
 * Uses caching to reduce API calls
 * @param {string} cloudId - Jira Cloud ID
 * @param {string} orgName - Optional organization name
 * @param {string} jiraUrl - Optional Jira instance URL
 * @returns {Promise<Object>} Organization object
 */
export async function getOrCreateOrganization(cloudId, orgName = null, jiraUrl = null) {
  const cacheKey = CacheKeys.organization(cloudId);

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const org = await remoteRequest('/api/forge/organization', {
      body: { orgName, jiraUrl }
    });

    // Cache the result
    setInCache(cacheKey, org, TTL.ORGANIZATION);

    return org;
  } catch (error) {
    console.error('[Remote] Error getting/creating organization:', error);
    throw error;
  }
}

/**
 * Get or create user by Atlassian account ID
 * Uses caching to reduce API calls
 * @param {string} accountId - Atlassian account ID (passed via FIT token)
 * @param {string} organizationId - Organization UUID
 * @param {string} email - Optional user email
 * @param {string} displayName - Optional display name
 * @returns {Promise<string>} User UUID
 */
export async function getOrCreateUser(accountId, organizationId = null, email = null, displayName = null) {
  const cacheKey = CacheKeys.userId(accountId);

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached && cached.organizationId === organizationId) {
    return cached.userId;
  }

  try {
    const result = await remoteRequest('/api/forge/user', {
      body: { organizationId, email, displayName }
    });

    // Cache the result
    setInCache(cacheKey, { userId: result.userId, organizationId }, TTL.USER_ID);

    return result.userId;
  } catch (error) {
    console.error('[Remote] Error getting/creating user:', error);
    throw error;
  }
}

/**
 * Get user's organization membership
 * @param {string} userId - User UUID
 * @param {string} organizationId - Organization UUID
 * @returns {Promise<Object|null>} Membership object or null
 */
export async function getOrganizationMembership(userId, organizationId) {
  try {
    const result = await remoteRequest('/api/forge/organization/membership', {
      body: { userId, organizationId }
    });

    return result;
  } catch (error) {
    console.error('[Remote] Error getting organization membership:', error);
    return null;
  }
}

/**
 * Upload file to Supabase Storage via AI server
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path
 * @param {Uint8Array|Buffer} data - File data
 * @param {string} contentType - MIME type
 * @returns {Promise<Object>} Upload result
 */
export async function uploadToStorage(bucket, path, data, contentType) {
  // Convert data to base64 for transmission
  const base64Data = typeof data === 'string' ? data : Buffer.from(data).toString('base64');

  return remoteRequest('/api/forge/storage/upload', {
    body: {
      bucket,
      path,
      data: base64Data,
      contentType
    }
  });
}

/**
 * Generate signed URL for storage file
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path
 * @param {number} expiresIn - Expiry time in seconds
 * @returns {Promise<string>} Signed URL
 */
export async function generateSignedUrl(bucket, path, expiresIn = 3600) {
  const result = await remoteRequest('/api/forge/storage/signed-url', {
    body: { bucket, path, expiresIn }
  });

  return result.signedUrl;
}

/**
 * Delete file from storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path
 * @returns {Promise<void>}
 */
export async function deleteFromStorage(bucket, path) {
  await remoteRequest('/api/forge/storage/delete', {
    body: { bucket, path }
  });
}

// Export the remote request function for custom calls
export { remoteRequest };
