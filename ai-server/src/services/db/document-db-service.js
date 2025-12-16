/**
 * Document Database Service Module
 * Handles document-related database operations
 */

const { getClient } = require('./supabase-client');
const logger = require('../../utils/logger');

/**
 * Update document status
 * @param {string} documentId - Document ID
 * @param {string} status - New status ('pending', 'processing', 'completed', 'error')
 * @param {string|null} errorMessage - Error message if status is 'error'
 * @returns {Promise<void>}
 */
async function updateDocumentStatus(documentId, status, errorMessage = null) {
  try {
    const supabase = getClient();
    const updateData = {
      processing_status: status,
      processed_at: status === 'completed' ? new Date().toISOString() : null
    };

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error updating document status:', error);
    throw new Error(`Failed to update document status: ${error.message}`);
  }
}

/**
 * Update document data (extracted text, parsed requirements, etc.)
 * @param {string} documentId - Document ID
 * @param {Object} data - Document data to update
 * @returns {Promise<void>}
 */
async function updateDocumentData(documentId, data) {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from('documents')
      .update(data)
      .eq('id', documentId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Error updating document data:', error);
    throw new Error(`Failed to update document data: ${error.message}`);
  }
}

/**
 * Get document by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object|null>} Document data or null
 */
async function getDocumentById(documentId) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error fetching document by ID:', error);
    return null;
  }
}

module.exports = {
  updateDocumentStatus,
  updateDocumentData,
  getDocumentById
};
