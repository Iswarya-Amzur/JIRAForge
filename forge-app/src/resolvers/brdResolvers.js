/**
 * BRD Resolvers
 * Resolver definitions for BRD document upload and processing endpoints
 */

import { uploadBRDDocument, createIssuesFromBRD, getBRDStatus } from '../services/brdService.js';

/**
 * Register BRD resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerBRDResolvers(resolver) {
  /**
   * Resolver for uploading BRD document
   */
  resolver.define('uploadBRD', async (req) => {
    const { payload, context } = req;
    const { fileName, fileType, fileData, fileSize } = payload; // fileData is base64
    const accountId = context.accountId;

    try {
      const result = await uploadBRDDocument(accountId, fileName, fileType, fileData, fileSize);
      return {
        success: true,
        documentId: result.documentId,
        message: result.message
      };
    } catch (error) {
      console.error('Error uploading BRD:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for creating Jira issues from BRD
   */
  resolver.define('createIssuesFromBRD', async (req) => {
    const { payload, context } = req;
    const { documentId, projectKey } = payload;
    const accountId = context.accountId;

    try {
      const result = await createIssuesFromBRD(accountId, documentId, projectKey);
      return {
        success: true,
        createdIssues: result.createdIssues,
        message: result.message
      };
    } catch (error) {
      console.error('Error creating issues from BRD:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Resolver for getting BRD document status and created issues
   */
  resolver.define('getBRDStatus', async (req) => {
    const { payload, context } = req;
    const { documentId } = payload;
    const accountId = context.accountId;

    try {
      const document = await getBRDStatus(accountId, documentId);
      return {
        success: true,
        document
      };
    } catch (error) {
      console.error('Error getting BRD status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
