/**
 * Supabase Storage Utilities
 * Handles file uploads, downloads, and signed URLs
 *
 * NOTE: These functions now route through the AI server via Forge Remote.
 * The supabaseConfig parameter is kept for backward compatibility but is ignored.
 */

import {
  uploadToStorage as remoteUploadToStorage,
  generateSignedUrl as remoteGenerateSignedUrl,
  deleteFromStorage as remoteDeleteFromStorage
} from '../remote.js';

/**
 * Upload file to Supabase Storage
 * @param {Object} supabaseConfig - DEPRECATED: Ignored, kept for backward compatibility
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in storage
 * @param {Uint8Array|Buffer} data - File data
 * @param {string} contentType - MIME type
 * @returns {Promise<Object>} Upload response
 */
export async function uploadToSupabaseStorage(supabaseConfig, bucket, path, data, contentType) {
  // supabaseConfig is ignored - credentials are managed by the AI server
  return remoteUploadToStorage(bucket, path, data, contentType);
}

/**
 * Generate signed URL for private storage file
 * @param {Object} supabaseConfig - DEPRECATED: Ignored, kept for backward compatibility
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in storage
 * @param {number} expiresIn - URL expiry time in seconds
 * @returns {Promise<string>} Signed URL
 */
export async function generateSignedUrl(supabaseConfig, bucket, path, expiresIn = 3600) {
  // supabaseConfig is ignored - credentials are managed by the AI server
  return remoteGenerateSignedUrl(bucket, path, expiresIn);
}

/**
 * Delete file from Supabase Storage
 * @param {Object} supabaseConfig - DEPRECATED: Ignored, kept for backward compatibility
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in storage
 * @returns {Promise<void>}
 */
export async function deleteFromSupabaseStorage(supabaseConfig, bucket, path) {
  // supabaseConfig is ignored - credentials are managed by the AI server
  return remoteDeleteFromStorage(bucket, path);
}
