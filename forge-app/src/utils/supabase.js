/**
 * Supabase utility functions
 * All Supabase-related operations should go through these helpers
 */

import { fetch, storage } from '@forge/api';

/**
 * Get Supabase client configuration from Forge storage
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object|null>} Supabase configuration or null if not configured
 */
export async function getSupabaseConfig(accountId) {
  try {
    const settings = await storage.get('global:app-settings');
    if (!settings) {
      return null;
    }
    return {
      url: settings.supabaseUrl,
      serviceRoleKey: settings.supabaseServiceRoleKey,
      anonKey: settings.supabaseAnonKey
    };
  } catch (error) {
    console.error('Error getting Supabase config:', error);
    return null;
  }
}

/**
 * Get or create user record in Supabase
 * @param {string} accountId - Atlassian account ID
 * @param {Object} supabaseConfig - Supabase configuration
 * @returns {Promise<string>} Supabase user UUID
 */
export async function getOrCreateUser(accountId, supabaseConfig) {
  try {
    // First, try to get user by Atlassian account ID
    const response = await fetch(`${supabaseConfig.url}/rest/v1/users?atlassian_account_id=eq.${accountId}&select=id`, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Content-Type': 'application/json'
      }
    });

    const users = await response.json();

    if (users && users.length > 0) {
      return users[0].id;
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
        atlassian_account_id: accountId
      })
    });

    const newUser = await createResponse.json();
    return newUser[0].id;
  } catch (error) {
    console.error('Error getting/creating user:', error);
    throw error;
  }
}

/**
 * Make a request to Supabase REST API
 * @param {Object} supabaseConfig - Supabase configuration
 * @param {string} endpoint - API endpoint (e.g., 'screenshots', 'users?id=eq.123')
 * @param {Object} options - Request options (method, body, headers)
 * @returns {Promise<Object>} Response data
 */
export async function supabaseRequest(supabaseConfig, endpoint, options = {}) {
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase request failed: ${error}`);
  }

  return response.json();
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
