/**
 * Supabase Storage Utilities
 * Handles file uploads, downloads, and signed URLs
 */

import { fetch } from '@forge/api';

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
