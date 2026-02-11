/**
 * Feedback Resolvers
 * Handles feedback-related operations for the Forge app
 */

import { createFeedbackSession, submitFeedback } from '../utils/remote.js';

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

  /**
   * Submit feedback from the in-app modal
   * Validates inputs and submits via remote
   */
  resolver.define('submitFeedback', async (req) => {
    try {
      const { category, title, description, images } = req.payload;

      // Validate required fields
      if (!category) {
        return { success: false, error: 'Category is required' };
      }
      if (!description || !description.trim()) {
        return { success: false, error: 'Description is required' };
      }

      // Validate images
      if (images && images.length > 3) {
        return { success: false, error: 'Maximum 3 screenshots allowed' };
      }

      const result = await submitFeedback({
        category,
        title: title || '',
        description: description.trim(),
        images: images || []
      });

      return {
        success: true,
        message: 'Feedback submitted successfully',
        feedbackId: result.feedbackId || result.id
      };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
