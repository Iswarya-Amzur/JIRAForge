/**
 * Storage Service Module
 * Handles Supabase Storage operations (file uploads/downloads)
 */

const { getClient } = require('./supabase-client');
const logger = require('../../utils/logger');

/**
 * Download a file from Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} filePath - Path to the file in the bucket
 * @returns {Promise<Buffer>} File contents as a buffer
 */
async function downloadFile(bucket, filePath) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      throw error;
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await data.arrayBuffer());
    return buffer;
  } catch (error) {
    logger.error('Error downloading file from Supabase:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

/**
 * Upload a file to Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} filePath - Destination path in the bucket
 * @param {Buffer} fileBuffer - File contents as a buffer
 * @param {Object} options - Upload options (contentType, etc.)
 * @returns {Promise<Object>} Upload result
 */
async function uploadFile(bucket, filePath, fileBuffer, options = {}) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: options.contentType || 'application/octet-stream',
        upsert: options.upsert || false
      });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error uploading file to Supabase:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Get public URL for a file in Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} filePath - Path to the file in the bucket
 * @returns {string} Public URL
 */
function getPublicUrl(bucket, filePath) {
  const supabase = getClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} filePath - Path to the file in the bucket
 * @returns {Promise<void>}
 */
async function deleteFile(bucket, filePath) {
  try {
    const supabase = getClient();
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error deleting file from Supabase:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

module.exports = {
  downloadFile,
  uploadFile,
  getPublicUrl,
  deleteFile
};
