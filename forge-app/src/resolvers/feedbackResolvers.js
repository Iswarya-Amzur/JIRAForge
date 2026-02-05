/**
 * Feedback Resolvers
 * Handles feedback-related operations for the Forge app
 */

import { createFeedbackSession } from '../utils/remote.js';

/**
 * Register feedback resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerFeedbackResolvers(resolver) {
  /**
   * Get a feedback form URL
   * Creates a feedback session and returns a URL that can be opened in a browser
   */
  resolver.define('getFeedbackUrl', async (req) => {
    try {
      const feedbackUrl = await createFeedbackSession();

      return {
        success: true,
        feedbackUrl
      };
    } catch (error) {
      console.error('Error creating feedback session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
