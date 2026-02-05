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

    // First, check if the file exists by listing the path
    // This gives us better error information than a failed download
    const pathParts = filePath.split('/');
    const fileName = pathParts.pop();
    const folderPath = pathParts.join('/');

    const { data: listData, error: listError } = await supabase.storage
      .from(bucket)
      .list(folderPath, {
        limit: 1,
        search: fileName
      });

    if (listError) {
      logger.error('Error listing file in Supabase storage', {
        bucket,
        filePath,
        folderPath,
        fileName,
        error: listError.message || JSON.stringify(listError),
        errorName: listError.name,
        statusCode: listError.statusCode
      });
      throw new Error(`File listing failed: ${listError.message || 'Unknown error'}`);
    }

    if (!listData || listData.length === 0) {
      logger.error('File not found in Supabase storage', {
        bucket,
        filePath,
        folderPath,
        fileName
      });
      throw new Error(`File not found: ${filePath}`);
    }

    // File exists, now download it
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      // Extract useful information from the Supabase error
      const errorInfo = {
        message: error.message || 'Unknown error',
        name: error.name || 'UnknownError',
        statusCode: error.statusCode,
        error: error.error,
        bucket,
        filePath
      };
      logger.error('Error downloading file from Supabase', errorInfo);
      throw new Error(`Failed to download file: ${errorInfo.message}`);
    }

    if (!data) {
      logger.error('No data returned from Supabase download', { bucket, filePath });
      throw new Error('Download returned no data');
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await data.arrayBuffer());
    return buffer;
  } catch (error) {
    // If it's already our formatted error, rethrow it
    if (error.message && !error.message.startsWith('Failed to download')) {
      throw error;
    }
    // Otherwise log with more context
    logger.error('Error downloading file from Supabase', {
      bucket,
      filePath,
      errorMessage: error.message,
      errorName: error.name,
      __isStorageError: error.__isStorageError,
      stack: error.stack
    });
    throw new Error(`Failed to download file: ${error.message || 'Unknown storage error'}`);
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
