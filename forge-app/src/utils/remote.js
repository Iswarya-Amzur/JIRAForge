/**
 * Remote API Utility
 * Handles all communication with the AI server via Forge Remote
 * The AI server handles Supabase operations securely without exposing credentials
 */

import { invokeRemote } from '@forge/api';
import api, { route } from '@forge/api';
import { getFromCache, setInCache, TTL, CacheKeys } from './cache.js';

// Remote key from manifest.yml - must match exactly
const REMOTE_KEY = 'ai-server';

/**
 * Make a request to the AI server via Forge Remote
 * Uses invokeRemote which automatically adds the FIT token
 * Requires 'compute' in the remote's operations array in manifest.yml
 * @param {string} endpoint - API endpoint path (e.g., '/api/forge/organization')
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response data
 */
async function remoteRequest(endpoint, options = {}) {
  console.log(`[Remote] invokeRemote to ${REMOTE_KEY}${endpoint}`);

  try {
    const response = await invokeRemote(REMOTE_KEY, {
      path: endpoint,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    console.log(`[Remote] Response status: ${response.status}`);

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
  } catch (error) {
    console.error(`[Remote] invokeRemote error:`, error.message);
    throw error;
  }
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
 * Automatically fetches Jira site info if orgName/jiraUrl not provided
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
    // If orgName or jiraUrl not provided, fetch from Jira API
    if (!orgName || !jiraUrl) {
      try {
        console.log('[Remote] Fetching Jira server info for organization details');
        const serverInfoResponse = await api.asApp().requestJira(
          route`/rest/api/3/serverInfo`,
          { method: 'GET' }
        );

        if (serverInfoResponse.ok) {
          const serverInfo = await serverInfoResponse.json();
          jiraUrl = jiraUrl || serverInfo.baseUrl;

          // serverTitle often returns generic "Jira" - extract site name from URL instead
          let siteName = serverInfo.serverTitle;
          if (!siteName || siteName === 'Jira' || siteName === 'Jira Software') {
            // Extract subdomain from URL (e.g., "saik" from "https://saik.atlassian.net")
            try {
              const url = new URL(jiraUrl);
              const subdomain = url.hostname.split('.')[0];
              // Only use subdomain if it's not a UUID (cloud IDs look like UUIDs)
              if (subdomain && !subdomain.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
                siteName = subdomain;
              }
            } catch (e) {
              // URL parsing failed, keep serverTitle
            }
          }

          orgName = orgName || siteName || 'Unknown Organization';
          console.log(`[Remote] Got Jira info - Name: ${orgName}, URL: ${jiraUrl}`);
        }
      } catch (apiError) {
        console.warn('[Remote] Could not fetch Jira server info:', apiError.message);
        // Continue with defaults if API call fails
      }
    }

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

/**
 * Fetch all dashboard data in a single batch request
 * This replaces 8+ individual API calls with 1 request
 * Significantly improves page load time and reduces server load
 * 
 * @param {Object} options - Dashboard options
 * @param {boolean} options.canViewAllUsers - Whether user has admin/team view permissions
 * @param {number} options.maxDailySummaryDays - Max days for daily summary (default: 30)
 * @param {number} options.maxWeeklySummaryWeeks - Max weeks for weekly summary (default: 12)
 * @param {number} options.maxIssuesInAnalytics - Max issues to return (default: 50)
 * @returns {Promise<Object>} Complete dashboard data
 */
export async function fetchDashboardData(options = {}) {
  const cacheKey = 'dashboard:batch';
  
  // Short-lived cache (30 seconds) for dashboard data
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log('[Remote] Using cached dashboard data');
    return cached;
  }

  console.log('[Remote] Fetching dashboard data (batch)');
  
  const result = await remoteRequest('/api/forge/dashboard', {
    body: {
      canViewAllUsers: options.canViewAllUsers || false,
      maxDailySummaryDays: options.maxDailySummaryDays || 30,
      maxWeeklySummaryWeeks: options.maxWeeklySummaryWeeks || 12,
      maxIssuesInAnalytics: options.maxIssuesInAnalytics || 50
    }
  });

  // Cache for 30 seconds - dashboard data is moderately dynamic
  setInCache(cacheKey, result, 30 * 1000);

  return result;
}

/**
 * Get the latest desktop app version information
 * Used for update notifications in the Forge UI
 * 
 * @param {Object} options - Version check options
 * @param {string} options.platform - Platform to check (default: 'windows')
 * @param {string} options.currentVersion - User's current app version (optional)
 * @returns {Promise<Object>} Latest version info
 */
export async function getLatestAppVersion(options = {}) {
  const cacheKey = `app-version:${options.platform || 'windows'}`;
  
  // Cache version info for 5 minutes - doesn't change frequently
  const cached = getFromCache(cacheKey);
  if (cached) {
    // If we have a cached result and currentVersion changed, recalculate updateAvailable
    if (options.currentVersion && cached.latestVersion) {
      cached.updateAvailable = isNewerVersion(cached.latestVersion, options.currentVersion);
      cached.currentVersion = options.currentVersion;
    }
    return cached;
  }

  console.log('[Remote] Fetching latest app version');
  
  const result = await remoteRequest('/api/forge/app-version/latest', {
    body: {
      platform: options.platform || 'windows',
      currentVersion: options.currentVersion
    }
  });

  // Cache for 5 minutes
  setInCache(cacheKey, result, 5 * 60 * 1000);

  return result;
}

/**
 * Compare two semantic versions
 * @param {string} v1 - Version to compare (latest)
 * @param {string} v2 - Version to compare against (current)
 * @returns {boolean} True if v1 is newer than v2
 */
function isNewerVersion(v1, v2) {
  if (!v1 || !v2) return false;
  
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  
  return false; // Versions are equal
}

// Export the remote request function for custom calls
export { remoteRequest };
