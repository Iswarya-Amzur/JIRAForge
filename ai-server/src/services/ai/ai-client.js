/**
 * AI Client Module
 * Centralized AI client management with 3-tier fallback
 *
 * Flow:
 * 1. LiteLLM with Gemini (primary) - gemini/gemini-2.0-flash
 * 2. LiteLLM with GPT-4o (fallback 1) - gpt-4o
 * 3. Fireworks AI (fallback 2) - Qwen2.5-VL-32B
 */

const OpenAI = require('openai');
const logger = require('../../utils/logger');
const { logLLMRequest } = require('../sheets-logger');

// Client instances
let fireworksClient = null;
let litellmClient = null;

// Failure tracking state
let consecutiveFailures = 0;
let fallbackActive = false;
let fallbackStartTime = null;

// Configuration (with defaults)
const getFailureThreshold = () => parseInt(process.env.FAILURE_THRESHOLD) || 3;
const getCooldownMinutes = () => parseInt(process.env.COOLDOWN_MINUTES) || 5;

/**
 * Check if Fireworks AI is enabled via environment variable
 * @returns {boolean} True if USE_FIREWORKS is set to 'true'
 */
function isFireworksEnabled() {
  return process.env.USE_FIREWORKS === 'true';
}

/**
 * Check if LiteLLM is enabled via environment variable
 * @returns {boolean} True if USE_LITELLM is set to 'true'
 */
function isLiteLLMEnabled() {
  return process.env.USE_LITELLM === 'true';
}

/**
 * Initialize the Fireworks AI client
 * @returns {OpenAI|null} Fireworks client or null if not configured
 */
function initializeFireworksClient() {
  const fireworksApiKey = process.env.FIREWORKS_API_KEY;
  const fireworksBaseUrl = process.env.FIREWORKS_BASE_URL || 'https://api.fireworks.ai/inference/v1';

  if (!fireworksApiKey) {
    logger.warn('[AI] Fireworks API key not configured');
    return null;
  }

  try {
    fireworksClient = new OpenAI({
      apiKey: fireworksApiKey,
      baseURL: fireworksBaseUrl
    });
    const model = getFireworksModel();
    logger.info('[AI] Fireworks initialized | Endpoint: %s | Model: %s', fireworksBaseUrl, getShortModelName(model));
    return fireworksClient;
  } catch (error) {
    logger.error('[AI] Fireworks init failed: %s', error.message);
    return null;
  }
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
    logger.info('[AI] LiteLLM initialized | Endpoint: %s | Model: %s', litellmBaseUrl, getShortModelName(process.env.LITELLM_MODEL || 'openai/gpt-4o'));
    return litellmClient;
  } catch (error) {
    logger.error('[AI] LiteLLM init failed: %s', error.message);
    return null;
  }
}

/**
 * Initialize all clients
 * Called once at application startup
 */
function initializeClient() {
  logger.info('[AI] Initializing AI clients...');
  logger.info('[AI] Config: USE_FIREWORKS=%s | USE_LITELLM=%s',
    process.env.USE_FIREWORKS || 'false',
    process.env.USE_LITELLM || 'false');

  // Initialize Fireworks if enabled (primary)
  if (isFireworksEnabled()) {
    initializeFireworksClient();
  }

  // Initialize LiteLLM if enabled (fallback)
  if (isLiteLLMEnabled()) {
    initializeLiteLLMClient();
  }

  // Log the 3-tier fallback mode
  const litellmEnabled = isLiteLLMEnabled();
  const fireworksEnabled = isFireworksEnabled();

  if (!litellmEnabled && !fireworksEnabled) {
    logger.warn('[AI] WARNING: No AI providers enabled! AI features will not work.');
  } else {
    const chain = [];
    if (litellmEnabled) {
      chain.push(`LiteLLM/Gemini (${getShortModelName(getLiteLLMModel())})`);
      chain.push(`LiteLLM/GPT-4o (${getShortModelName(getLiteLLMFallbackModel())})`);
    }
    if (fireworksEnabled) {
      chain.push(`Fireworks (${getShortModelName(getFireworksModel())})`);
    }
    logger.info('[AI] 3-Tier Fallback Chain: %s', chain.join(' -> '));
  }

  return getClient();
}

/**
 * Get the Fireworks client instance
 * @returns {OpenAI|null} Fireworks client or null
 */
function getFireworksClient() {
  if (!fireworksClient && isFireworksEnabled() && process.env.FIREWORKS_API_KEY) {
    logger.info('[AI] getFireworksClient() lazy init');
    initializeFireworksClient();
  }
  return fireworksClient;
}

/**
 * Get the LiteLLM client instance
 * @returns {OpenAI|null} LiteLLM client or null
 */
function getLiteLLMClient() {
  if (!litellmClient && isLiteLLMEnabled() && process.env.LITELLM_API_KEY) {
    logger.info('[AI] getLiteLLMClient() lazy init');
    initializeLiteLLMClient();
  }
  return litellmClient;
}

/**
 * Get primary client based on configuration
 * @returns {OpenAI|null} Primary client based on configuration
 */
function getClient() {
  // Priority: Fireworks -> LiteLLM
  if (isFireworksEnabled() && !shouldUseFallback()) {
    return getFireworksClient() || getLiteLLMClient();
  }
  if (isLiteLLMEnabled()) {
    return getLiteLLMClient();
  }
  return getFireworksClient();
}

/**
 * Check if AI analysis is enabled
 * @returns {boolean} True if any AI client is available
 */
function isAIEnabled() {
  const hasClient = getFireworksClient() !== null || getLiteLLMClient() !== null;
  return hasClient && process.env.USE_AI_FOR_SCREENSHOTS !== 'false';
}

/**
 * Check if we should use fallback due to primary provider failures
 * @returns {boolean} True if fallback mode is active and cooldown hasn't passed
 */
function shouldUseFallback() {
  if (!fallbackActive) return false;

  // Check if cooldown period has passed
  const cooldownMs = getCooldownMinutes() * 60 * 1000;
  const elapsed = Date.now() - fallbackStartTime;

  if (elapsed >= cooldownMs) {
    // Cooldown complete, reset and try primary again
    logger.info('[AI] Cooldown complete - switching back to primary provider');
    fallbackActive = false;
    consecutiveFailures = 0;
    return false;
  }

  const remainingMin = Math.ceil((cooldownMs - elapsed) / 60000);
  logger.debug('[AI] Fallback active - %d min remaining', remainingMin);
  return true;
}

/**
 * Handle primary provider request failure
 * Tracks consecutive failures and activates fallback if threshold reached
 * @param {Error} error - The error that occurred
 * @param {string} provider - The provider name (Fireworks, LiteLLM)
 */
function handlePrimaryFailure(error, provider) {
  consecutiveFailures++;
  logger.warn('[AI] %s failed (%d/%d): %s', provider, consecutiveFailures, getFailureThreshold(), error.message);

  if (consecutiveFailures >= getFailureThreshold()) {
    fallbackActive = true;
    fallbackStartTime = Date.now();
    logger.warn('[AI] Switching to fallback for %d minutes', getCooldownMinutes());
  }
}

/**
 * Handle successful primary provider request
 * Resets failure counter
 */
function handlePrimarySuccess() {
  if (consecutiveFailures > 0) {
    logger.info('[AI] Primary provider recovered after %d failure(s)', consecutiveFailures);
  }
  consecutiveFailures = 0;
}

/**
 * Get the Fireworks model name
 * @returns {string} Model name for Fireworks requests
 */
function getFireworksModel() {
  return process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/qwen2p5-vl-32b-instruct';
}

/**
 * Get the LiteLLM primary model name (Gemini)
 * @returns {string} Model name for LiteLLM requests
 */
function getLiteLLMModel() {
  return process.env.LITELLM_MODEL || 'gemini/gemini-2.0-flash';
}

/**
 * Get the LiteLLM fallback model name (GPT-4o)
 * @returns {string} Fallback model name for LiteLLM requests
 */
function getLiteLLMFallbackModel() {
  return process.env.LITELLM_FALLBACK_MODEL || 'gpt-4o';
}

/**
 * Get short model name for logging
 * @param {string} model - Full model name
 * @returns {string} Short model name
 */
function getShortModelName(model) {
  // Fireworks models
  if (model.includes('qwen2p5-vl-32b')) return 'Qwen2.5-VL-32B';
  if (model.includes('qwen2p5-vl-72b')) return 'Qwen2.5-VL-72B';
  if (model.includes('llama-v3p2-11b-vision')) return 'Llama-11B-Vision';
  // OpenAI models
  if (model.includes('gpt-4o-mini')) return 'GPT-4o-Mini';
  if (model.includes('gpt-4o')) return 'GPT-4o';
  if (model.includes('gpt-4-turbo')) return 'GPT-4-Turbo';
  if (model.includes('gpt-4')) return 'GPT-4';
  // Gemini models
  if (model.includes('gemini-2.0-flash-lite')) return 'Gemini-2.0-Flash-Lite';
  if (model.includes('gemini-2.0-flash')) return 'Gemini-2.0-Flash';
  if (model.includes('gemini-1.5-flash')) return 'Gemini-1.5-Flash';
  if (model.includes('gemini-1.5-pro')) return 'Gemini-1.5-Pro';
  // Fallback: extract last part of model path
  return model.split('/').pop() || model;
}

/**
 * Get the configured vision model (based on current mode)
 * @returns {string} Model name for vision analysis
 */
function getVisionModel() {
  if (isFireworksEnabled() && !shouldUseFallback()) {
    return getFireworksModel();
  }
  if (isLiteLLMEnabled()) {
    return getLiteLLMModel();
  }
  return getFireworksModel();
}

/**
 * Get the configured text model (based on current mode)
 * @returns {string} Model name for text analysis
 */
function getTextModel() {
  if (isFireworksEnabled() && !shouldUseFallback()) {
    return getFireworksModel();
  }
  if (isLiteLLMEnabled()) {
    return getLiteLLMModel();
  }
  return getFireworksModel();
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
  let currentProvider = 'none';
  if (isFireworksEnabled() && !shouldUseFallback()) {
    currentProvider = 'fireworks';
  } else if (isLiteLLMEnabled()) {
    currentProvider = 'litellm';
  }

  return {
    fireworksEnabled: isFireworksEnabled(),
    litellmEnabled: isLiteLLMEnabled(),
    fallbackActive,
    consecutiveFailures,
    cooldownRemaining: fallbackActive
      ? Math.max(0, getCooldownMinutes() * 60 * 1000 - (Date.now() - fallbackStartTime))
      : 0,
    currentProvider
  };
}

/**
 * Execute a chat completion with 3-tier automatic fallback:
 * LiteLLM (Gemini) -> LiteLLM (GPT-4o) -> Fireworks (Qwen)
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
  const litellmPrimaryModel = getLiteLLMModel();      // Gemini
  const litellmFallbackModel = getLiteLLMFallbackModel(); // GPT-4o
  const fireworksModel = getFireworksModel();         // Qwen

  // Check if circuit breaker is active (skip Gemini if too many recent failures)
  const skipGemini = shouldUseFallback();
  if (skipGemini) {
    logger.info('[AI] Circuit breaker active - skipping Gemini, going directly to GPT-4o');
  }

  // === TIER 1: LiteLLM with Gemini (Primary) ===
  if (isLiteLLMEnabled() && !skipGemini) {
    const litellm = getLiteLLMClient();
    if (litellm) {
      try {
        const startTime = Date.now();
        logger.info('[AI] %s request via LiteLLM/Gemini (%s)', requestType, getShortModelName(litellmPrimaryModel));

        const response = await litellm.chat.completions.create({
          model: litellmPrimaryModel,
          messages,
          temperature,
          max_tokens,
          user: getLiteLLMUser()
        });

        const duration = Date.now() - startTime;
        handlePrimarySuccess();
        logger.info('[AI] %s request completed | LiteLLM/Gemini | %dms', requestType, duration);

        return { response, provider: 'litellm-gemini', model: litellmPrimaryModel };
      } catch (error) {
        handlePrimaryFailure(error, 'LiteLLM/Gemini');
        errors.push({ provider: 'litellm-gemini', error: error.message });
        // Continue to GPT-4o fallback
      }
    }
  }

  // === TIER 2: LiteLLM with GPT-4o (Fallback 1) ===
  if (isLiteLLMEnabled()) {
    const litellm = getLiteLLMClient();
    if (litellm) {
      try {
        const startTime = Date.now();
        logger.info('[AI] %s request via LiteLLM/GPT-4o (Gemini failed) (%s)', requestType, getShortModelName(litellmFallbackModel));

        const response = await litellm.chat.completions.create({
          model: litellmFallbackModel,
          messages,
          temperature,
          max_tokens,
          user: getLiteLLMUser()
        });

        const duration = Date.now() - startTime;
        logger.info('[AI] %s request completed | LiteLLM/GPT-4o | %dms', requestType, duration);

        return { response, provider: 'litellm-gpt4o', model: litellmFallbackModel };
      } catch (error) {
        logger.warn('[AI] LiteLLM/GPT-4o failed: %s', error.message);
        errors.push({ provider: 'litellm-gpt4o', error: error.message });
        // Continue to Fireworks fallback
      }
    }
  }

  // === TIER 3: Fireworks (Fallback 2) ===
  if (isFireworksEnabled()) {
    const fireworks = getFireworksClient();
    if (fireworks) {
      try {
        const startTime = Date.now();
        logger.info('[AI] %s request via Fireworks (LiteLLM failed) (%s)', requestType, getShortModelName(fireworksModel));

        const response = await fireworks.chat.completions.create({
          model: fireworksModel,
          messages,
          temperature,
          max_tokens
        });

        const duration = Date.now() - startTime;
        logger.info('[AI] %s request completed | Fireworks | %dms', requestType, duration);

        // Log to Google Sheets (async, don't block response)
        const usage = response.usage || {};
        logLLMRequest({
          apiCallName: requestType,
          provider: 'Fireworks',
          model: fireworksModel,
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0
        }).catch(() => {}); // Ignore logging errors

        return { response, provider: 'fireworks', model: fireworksModel };
      } catch (error) {
        logger.error('[AI] Fireworks failed: %s', error.message);
        errors.push({ provider: 'fireworks', error: error.message });
      }
    }
  }

  // All providers failed
  const errorMsg = errors.map(e => `${e.provider}: ${e.error}`).join('; ');
  logger.error('[AI] All 3 providers failed: %s', errorMsg);
  throw new Error(`All AI providers failed: ${errorMsg}`);
}

module.exports = {
  // Initialization
  initializeClient,

  // Client getters
  getClient,
  getFireworksClient,
  getLiteLLMClient,

  // Status checks
  isAIEnabled,
  isFireworksEnabled,
  isLiteLLMEnabled,
  shouldUseFallback,
  getProviderStatus,

  // Model getters
  getVisionModel,
  getTextModel,
  getFireworksModel,
  getLiteLLMModel,
  getLiteLLMFallbackModel,
  getLiteLLMUser,

  // Main request function with fallback
  chatCompletionWithFallback
};
