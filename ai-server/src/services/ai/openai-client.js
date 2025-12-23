/**
 * OpenAI Client Module
 * Centralized AI client management with LiteLLM primary + OpenAI fallback
 *
 * Flow:
 * 1. LiteLLM is primary (if USE_LITELLM=true)
 * 2. If LiteLLM fails multiple times consecutively, switch to OpenAI fallback
 * 3. After cooldown period, try LiteLLM again
 */

const OpenAI = require('openai');
const logger = require('../../utils/logger');

// Client instances
let litellmClient = null;
let openaiClient = null;

// Failure tracking state
let consecutiveFailures = 0;
let fallbackActive = false;
let fallbackStartTime = null;

// Configuration (with defaults)
const getFailureThreshold = () => parseInt(process.env.LITELLM_FAILURE_THRESHOLD) || 3;
const getCooldownMinutes = () => parseInt(process.env.LITELLM_COOLDOWN_MINUTES) || 5;

/**
 * Check if LiteLLM is enabled via environment variable
 * @returns {boolean} True if USE_LITELLM is set to 'true'
 */
function isLiteLLMEnabled() {
  return process.env.USE_LITELLM === 'true';
}

/**
 * Check if OpenAI is enabled via environment variable
 * @returns {boolean} True if USE_OPENAI is set to 'true' (defaults to true for backward compatibility)
 */
function isOpenAIEnabled() {
  // Default to true for backward compatibility (fallback behavior)
  return process.env.USE_OPENAI !== 'false';
}

/**
 * Initialize the LiteLLM client
 * @returns {OpenAI|null} LiteLLM client or null if not configured
 */
function initializeLiteLLMClient() {
  const litellmApiKey = process.env.LITELLM_API_KEY;
  const litellmBaseUrl = process.env.LITELLM_BASE_URL || 'https://litellm.amzur.com';

  if (!litellmApiKey) {
    logger.warn('[AI] LiteLLM API key not configured');
    return null;
  }

  try {
    litellmClient = new OpenAI({
      apiKey: litellmApiKey,
      baseURL: litellmBaseUrl
    });
    logger.info('[AI] LiteLLM initialized | Endpoint: %s | Model: %s', litellmBaseUrl, getShortModelName(process.env.LITELLM_MODEL || 'llama-v3p2-90b-vision'));
    return litellmClient;
  } catch (error) {
    logger.error('[AI] LiteLLM init failed: %s', error.message);
    return null;
  }
}

/**
 * Initialize the direct OpenAI client (for fallback)
 * @returns {OpenAI|null} OpenAI client or null if not configured
 */
function initializeOpenAIClient() {
  if (!isOpenAIEnabled()) {
    logger.info('[AI] OpenAI disabled (USE_OPENAI=false)');
    return null;
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn('[AI] OpenAI API key not configured - fallback disabled');
    return null;
  }

  try {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    logger.info('[AI] OpenAI initialized (fallback) | Vision: %s | Text: %s', process.env.OPENAI_VISION_MODEL || 'gpt-4o', process.env.OPENAI_MODEL || 'gpt-4o-mini');
    return openaiClient;
  } catch (error) {
    logger.error('[AI] OpenAI init failed: %s', error.message);
    return null;
  }
}

/**
 * Initialize all clients
 * Called once at application startup
 */
function initializeClient() {
  logger.info('[AI] Initializing AI clients...');
  logger.info('[AI] Config: USE_LITELLM=%s | USE_OPENAI=%s', process.env.USE_LITELLM || 'false', process.env.USE_OPENAI !== 'false' ? 'true' : 'false');

  // Initialize OpenAI if enabled (for fallback or primary)
  if (isOpenAIEnabled()) {
    initializeOpenAIClient();
  } else {
    logger.info('[AI] OpenAI disabled (USE_OPENAI=false)');
  }

  // Initialize LiteLLM if enabled
  if (isLiteLLMEnabled()) {
    initializeLiteLLMClient();
    if (isOpenAIEnabled()) {
      logger.info('[AI] Mode: LiteLLM primary + OpenAI fallback | Threshold: %d failures | Cooldown: %d min', getFailureThreshold(), getCooldownMinutes());
    } else {
      logger.info('[AI] Mode: LiteLLM only (no fallback)');
    }
  } else if (isOpenAIEnabled()) {
    logger.info('[AI] Mode: OpenAI only (USE_LITELLM=false)');
  } else {
    logger.warn('[AI] WARNING: Both LiteLLM and OpenAI are disabled! AI features will not work.');
  }

  return getClient();
}

/**
 * Get the LiteLLM client instance
 * @returns {OpenAI|null} LiteLLM client or null
 */
function getLiteLLMClient() {
  if (!litellmClient && isLiteLLMEnabled() && process.env.LITELLM_API_KEY) {
    logger.info('[AI] getLiteLLMClient() lazy init | USE_LITELLM=%s | API_KEY=%s', 
      process.env.USE_LITELLM, 
      process.env.LITELLM_API_KEY ? 'present' : 'missing');
    initializeLiteLLMClient();
  }
  return litellmClient;
}

/**
 * Get the direct OpenAI client instance
 * @returns {OpenAI|null} Direct OpenAI client or null
 */
function getOpenAIClient() {
  if (!openaiClient && isOpenAIEnabled() && process.env.OPENAI_API_KEY) {
    initializeOpenAIClient();
  }
  return openaiClient;
}

/**
 * Get primary client (for backward compatibility)
 * @returns {OpenAI|null} Primary client based on configuration
 */
function getClient() {
  if (isLiteLLMEnabled() && !shouldUseFallback()) {
    return getLiteLLMClient() || getOpenAIClient();
  }
  return getOpenAIClient();
}

/**
 * Check if AI analysis is enabled
 * @returns {boolean} True if any AI client is available
 */
function isAIEnabled() {
  const hasClient = getLiteLLMClient() !== null || getOpenAIClient() !== null;
  return hasClient && process.env.USE_AI_FOR_SCREENSHOTS !== 'false';
}

/**
 * Check if we should use OpenAI fallback due to LiteLLM failures
 * @returns {boolean} True if fallback mode is active and cooldown hasn't passed
 */
function shouldUseFallback() {
  if (!fallbackActive) return false;

  // Check if cooldown period has passed
  const cooldownMs = getCooldownMinutes() * 60 * 1000;
  const elapsed = Date.now() - fallbackStartTime;

  if (elapsed >= cooldownMs) {
    // Cooldown complete, reset and try LiteLLM again
    logger.info('[AI] Cooldown complete - switching back to LiteLLM');
    fallbackActive = false;
    consecutiveFailures = 0;
    return false;
  }

  const remainingMin = Math.ceil((cooldownMs - elapsed) / 60000);
  logger.debug('[AI] Fallback active - %d min remaining', remainingMin);
  return true;
}

/**
 * Handle LiteLLM request failure
 * Tracks consecutive failures and activates fallback if threshold reached
 */
function handleLiteLLMFailure(error) {
  consecutiveFailures++;
  logger.warn('[AI] LiteLLM failed (%d/%d): %s', consecutiveFailures, getFailureThreshold(), error.message);

  if (consecutiveFailures >= getFailureThreshold()) {
    fallbackActive = true;
    fallbackStartTime = Date.now();
    logger.warn('[AI] Switching to OpenAI fallback for %d minutes', getCooldownMinutes());
  }
}

/**
 * Handle successful LiteLLM request
 * Resets failure counter
 */
function handleLiteLLMSuccess() {
  if (consecutiveFailures > 0) {
    logger.info('[AI] LiteLLM recovered after %d failure(s)', consecutiveFailures);
  }
  consecutiveFailures = 0;
}

/**
 * Get the LiteLLM model name
 * @returns {string} Model name for LiteLLM requests
 */
function getLiteLLMModel() {
  return process.env.LITELLM_MODEL || 'fireworks_ai/accounts/fireworks/models/llama-v3p2-90b-vision-instruct';
}

/**
 * Get short model name for logging
 * @param {string} model - Full model name
 * @returns {string} Short model name
 */
function getShortModelName(model) {
  // LiteLLM models
  if (model.includes('llama-v3p2-90b-vision')) return 'Llama-90B-Vision';
  // OpenAI models
  if (model.includes('gpt-4o-mini')) return 'GPT-4o-mini';
  if (model.includes('gpt-4o')) return 'GPT-4o';
  if (model.includes('gpt-4')) return 'GPT-4';
  // Fallback: extract last part of model path
  return model.split('/').pop() || model;
}

/**
 * Get the configured vision model for direct OpenAI
 * @returns {string} Model name for vision analysis
 */
function getOpenAIVisionModel() {
  return process.env.OPENAI_VISION_MODEL || 'gpt-4o';
}

/**
 * Get the configured text model for direct OpenAI
 * @returns {string} Model name for text analysis
 */
function getOpenAITextModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

/**
 * Get the configured vision model (based on current mode)
 * @returns {string} Model name for vision analysis
 */
function getVisionModel() {
  if (isLiteLLMEnabled() && !shouldUseFallback()) {
    return getLiteLLMModel();
  }
  return getOpenAIVisionModel();
}

/**
 * Get the configured text model (based on current mode)
 * @returns {string} Model name for text analysis
 */
function getTextModel() {
  if (isLiteLLMEnabled() && !shouldUseFallback()) {
    return getLiteLLMModel();
  }
  return getOpenAITextModel();
}

/**
 * Get user identifier for LiteLLM tracking
 * @returns {string} User email for usage tracking
 */
function getLiteLLMUser() {
  return process.env.LITELLM_USER || 'ai-server@amzur.com';
}

/**
 * Get current provider status for logging/monitoring
 * @returns {Object} Current AI provider status
 */
function getProviderStatus() {
  return {
    litellmEnabled: isLiteLLMEnabled(),
    openaiEnabled: isOpenAIEnabled(),
    fallbackActive,
    consecutiveFailures,
    cooldownRemaining: fallbackActive
      ? Math.max(0, getCooldownMinutes() * 60 * 1000 - (Date.now() - fallbackStartTime))
      : 0,
    currentProvider: isLiteLLMEnabled() && !shouldUseFallback() ? 'litellm' : (isOpenAIEnabled() ? 'openai' : 'none')
  };
}

/**
 * Execute a chat completion with automatic LiteLLM -> OpenAI fallback
 *
 * @param {Object} params - Chat completion parameters
 * @param {Array} params.messages - Messages array
 * @param {number} params.temperature - Temperature setting (default: 0.3)
 * @param {number} params.max_tokens - Max tokens (default: 800)
 * @param {boolean} params.isVision - Whether this is a vision request (default: false)
 * @returns {Promise<Object>} { response, provider, model }
 */
async function chatCompletionWithFallback({ messages, temperature = 0.3, max_tokens = 800, isVision = false }) {
  const errors = [];
  const requestType = isVision ? 'vision' : 'text';

  // Determine models
  const litellmModel = getLiteLLMModel();
  const openaiModel = isVision ? getOpenAIVisionModel() : getOpenAITextModel();

  // Try LiteLLM first (if enabled and not in fallback mode)
  if (isLiteLLMEnabled() && !shouldUseFallback()) {
    const litellm = getLiteLLMClient();
    if (litellm) {
      try {
        const startTime = Date.now();
        logger.info('[AI] %s request via LiteLLM (%s)', requestType, getShortModelName(litellmModel));

        const response = await litellm.chat.completions.create({
          model: litellmModel,
          messages,
          temperature,
          max_tokens,
          user: getLiteLLMUser()
        });

        const duration = Date.now() - startTime;
        handleLiteLLMSuccess();
        logger.info('[AI] %s request completed | LiteLLM | %dms', requestType, duration);
        return { response, provider: 'litellm', model: litellmModel };
      } catch (error) {
        handleLiteLLMFailure(error);
        errors.push({ provider: 'litellm', error: error.message });
        // Continue to OpenAI fallback
      }
    }
  }

  // Fallback to direct OpenAI (if enabled)
  if (!isOpenAIEnabled()) {
    logger.debug('[AI] OpenAI fallback skipped (USE_OPENAI=false)');
  }
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const startTime = Date.now();
      const note = fallbackActive ? ' (fallback)' : (errors.length > 0 ? ' (LiteLLM failed)' : '');
      logger.info('[AI] %s request via OpenAI%s (%s)', requestType, note, getShortModelName(openaiModel));

      const response = await openai.chat.completions.create({
        model: openaiModel,
        messages,
        temperature,
        max_tokens
      });

      const duration = Date.now() - startTime;
      logger.info('[AI] %s request completed | OpenAI | %dms', requestType, duration);
      return { response, provider: 'openai', model: openaiModel };
    } catch (error) {
      logger.error('[AI] OpenAI request failed: %s', error.message);
      errors.push({ provider: 'openai', error: error.message });
    }
  }

  // Both providers failed
  const errorMsg = errors.map(e => `${e.provider}: ${e.error}`).join('; ');
  logger.error('[AI] All providers failed: %s', errorMsg);
  throw new Error(`All AI providers failed: ${errorMsg}`);
}

module.exports = {
  // Initialization
  initializeClient,

  // Client getters
  getClient,
  getLiteLLMClient,
  getOpenAIClient,

  // Status checks
  isAIEnabled,
  isLiteLLMEnabled,
  isOpenAIEnabled,
  shouldUseFallback,
  getProviderStatus,

  // Model getters
  getVisionModel,
  getTextModel,
  getLiteLLMModel,
  getOpenAIVisionModel,
  getOpenAITextModel,
  getLiteLLMUser,

  // Main request function with fallback
  chatCompletionWithFallback
};
