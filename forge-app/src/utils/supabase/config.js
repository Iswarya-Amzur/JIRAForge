/**
 * Supabase Configuration and Request Utilities
 * Core functions for Supabase connectivity
 */

import { fetch, storage } from '@forge/api';
import { getFromCache, setInCache, TTL, CacheKeys } from '../cache.js';

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
      const delay = BASE_DELAY * Math.pow(2, retryCount);
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
