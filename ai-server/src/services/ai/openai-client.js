/**
 * OpenAI Client Module
 * Centralized OpenAI client initialization and management
 */

const OpenAI = require('openai');
const logger = require('../../utils/logger');

let openaiClient = null;

/**
 * Initialize the OpenAI client
 * Called once at application startup
 */
function initializeClient() {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set - AI analysis will be disabled');
    return null;
  }

  try {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    logger.info('OpenAI client initialized successfully');
    return openaiClient;
  } catch (error) {
    logger.error('Failed to initialize OpenAI client:', error);
    return null;
  }
}

/**
 * Get the OpenAI client instance
 * @returns {OpenAI|null} OpenAI client or null if not initialized
 */
function getClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    // Lazy initialization if not done at startup
    initializeClient();
  }
  return openaiClient;
}

/**
 * Check if AI analysis is enabled
 * @returns {boolean} True if OpenAI client is available and AI is enabled
 */
function isAIEnabled() {
  return getClient() !== null && process.env.USE_AI_FOR_SCREENSHOTS !== 'false';
}

/**
 * Get the configured vision model
 * @returns {string} Model name for vision analysis
 */
function getVisionModel() {
  return process.env.OPENAI_VISION_MODEL || 'gpt-4o';
}

/**
 * Get the configured text model
 * @returns {string} Model name for text analysis
 */
function getTextModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

module.exports = {
  initializeClient,
  getClient,
  isAIEnabled,
  getVisionModel,
  getTextModel
};
