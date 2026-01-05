/**
 * Supabase Configuration and Request Utilities
 * Core functions for Supabase connectivity
 *
 * NOTE: This module now provides backward-compatible stubs.
 * All Supabase operations are routed through the AI server via Forge Remote.
 * Credentials are stored securely on the AI server, not in Forge storage.
 */

import { supabaseQuery } from '../remote.js';

/**
 * Get Supabase client configuration
 * @deprecated Credentials are now managed by the AI server
 * @param {string} accountId - Atlassian account ID (ignored)
 * @returns {Promise<Object>} Placeholder config indicating remote mode
 */
export async function getSupabaseConfig(accountId) {
  // Return a placeholder to indicate the app is configured
  // Actual credentials are stored securely on the AI server
  return {
    url: 'remote:ai-server',
    serviceRoleKey: 'managed-by-ai-server',
    anonKey: 'managed-by-ai-server',
    isRemoteMode: true
  };
}

/**
 * Make a request to Supabase via the AI server
 * @deprecated Use supabaseQuery from remote.js instead
 * @param {Object} supabaseConfig - Supabase configuration (ignored in remote mode)
 * @param {string} endpoint - API endpoint (e.g., 'screenshots', 'users?id=eq.123')
 * @param {Object} options - Request options (method, body, headers)
 * @returns {Promise<Object>} Response data
 */
export async function supabaseRequest(supabaseConfig, endpoint, options = {}) {
  // Parse the endpoint to extract table and query parameters
  const [tablePart, queryString] = endpoint.split('?');
  const table = tablePart;

  // Parse query string into filter object
  const query = {};
  if (queryString) {
    const params = new URLSearchParams(queryString);
    for (const [key, value] of params.entries()) {
      // Parse Supabase filter format (e.g., "id=eq.123")
      const match = value.match(/^(eq|neq|gt|gte|lt|lte|in|is)\.(.+)$/);
      if (match) {
        const [, operator, val] = match;
        if (!query[operator]) query[operator] = {};
        // Handle 'in' operator which expects an array
        if (operator === 'in') {
          query[operator][key] = val.replace(/[()]/g, '').split(',');
        } else if (operator === 'is' && val === 'null') {
          query[operator][key] = null;
        } else {
          query[operator][key] = val;
        }
      } else {
        // Simple equality
        if (!query.eq) query.eq = {};
        query.eq[key] = value;
      }
    }
  }

  // Parse select from headers if present
  const select = options.headers?.Prefer?.includes('return=representation') ? '*' : undefined;

  // Map HTTP methods to query methods
  const method = options.method || 'GET';

  try {
    const result = await supabaseQuery(table, {
      method,
      query,
      body: options.body,
      select
    });

    return result;
  } catch (error) {
    console.error('[Supabase] Remote request failed:', error);
    throw error;
  }
}
