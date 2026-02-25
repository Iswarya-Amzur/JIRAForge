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
const { logCostTracking } = require('../cost-tracker');

// AI request timeout (default: 60 seconds)
const AI_REQUEST_TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '60000', 10);

// User email cache for LiteLLM user tracking (TTL: 10 minutes)
const userEmailCache = new Map();
const USER_EMAIL_CACHE_TTL = 10 * 60 * 1000;

// Client instances
let fireworksClient = null;
let litellmGeminiClient = null;   // For Gemini models
let litellmOpenAIClient = null;   // For GPT-4o models

// Dynamic provider management
const providerState = {
  // Track failures per provider
  failures: {
    'litellm-gemini': 0,
    'litellm-gpt4o': 0,
    'fireworks': 0
  },
  // Track demoted providers and when they were demoted
  demoted: {}, // { 'litellm-gemini': { demotedAt: timestamp, originalIndex: 0 } }
  // Current provider order (will be reordered dynamically)
  order: ['litellm-gemini', 'litellm-gpt4o', 'fireworks'],
  // Original order for restoration
  originalOrder: ['litellm-gemini', 'litellm-gpt4o', 'fireworks']
};

// Configuration (with defaults)
const getFailureThreshold = () => parseInt(process.env.FAILURE_THRESHOLD) || 2;
const getCooldownMinutes = () => parseInt(process.env.COOLDOWN_MINUTES) || 30;

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
      baseURL: fireworksBaseUrl,
      timeout: AI_REQUEST_TIMEOUT_MS,
      maxRetries: 0
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
 * Initialize the LiteLLM Gemini client
 * @returns {OpenAI|null} LiteLLM Gemini client or null if not configured
 */
function initializeLiteLLMGeminiClient() {
  const geminiApiKey = process.env.LITELLM_GEMINI_API_KEY;
  const litellmBaseUrl = process.env.LITELLM_BASE_URL || 'https://litellm.amzur.com';

  if (!geminiApiKey) {
    logger.warn('[AI] LiteLLM Gemini API key not configured');
    return null;
  }

  try {
    litellmGeminiClient = new OpenAI({
      apiKey: geminiApiKey,
      baseURL: litellmBaseUrl,
      timeout: AI_REQUEST_TIMEOUT_MS,
      maxRetries: 0
    });
    logger.info('[AI] LiteLLM/Gemini initialized | Endpoint: %s | Key: %s...',
      litellmBaseUrl, geminiApiKey.substring(0, 10));
    return litellmGeminiClient;
  } catch (error) {
    logger.error('[AI] LiteLLM/Gemini init failed: %s', error.message);
    return null;
  }
}

/**
 * Initialize the LiteLLM OpenAI/GPT-4o client
 * @returns {OpenAI|null} LiteLLM OpenAI client or null if not configured
 */
function initializeLiteLLMOpenAIClient() {
  const openaiApiKey = process.env.LITELLM_OPENAI_API_KEY;
  const litellmBaseUrl = process.env.LITELLM_BASE_URL || 'https://litellm.amzur.com';

  if (!openaiApiKey) {
    logger.warn('[AI] LiteLLM OpenAI API key not configured');
    return null;
  }

  try {
    litellmOpenAIClient = new OpenAI({
      apiKey: openaiApiKey,
      baseURL: litellmBaseUrl,
      timeout: AI_REQUEST_TIMEOUT_MS,
      maxRetries: 0
    });
    logger.info('[AI] LiteLLM/OpenAI initialized | Endpoint: %s | Key: %s...',
      litellmBaseUrl, openaiApiKey.substring(0, 10));
    return litellmOpenAIClient;
  } catch (error) {
    logger.error('[AI] LiteLLM/OpenAI init failed: %s', error.message);
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

  // Initialize Fireworks if enabled
  if (isFireworksEnabled()) {
    initializeFireworksClient();
  }

  // Initialize LiteLLM clients if enabled (separate keys for Gemini and OpenAI)
  if (isLiteLLMEnabled()) {
    initializeLiteLLMGeminiClient();
    initializeLiteLLMOpenAIClient();
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
 * Get the LiteLLM Gemini client instance
 * @returns {OpenAI|null} LiteLLM Gemini client or null
 */
function getLiteLLMGeminiClient() {
  if (!litellmGeminiClient && isLiteLLMEnabled() && process.env.LITELLM_GEMINI_API_KEY) {
    logger.info('[AI] getLiteLLMGeminiClient() lazy init');
    initializeLiteLLMGeminiClient();
  }
  return litellmGeminiClient;
}

/**
 * Get the LiteLLM OpenAI/GPT-4o client instance
 * @returns {OpenAI|null} LiteLLM OpenAI client or null
 */
function getLiteLLMOpenAIClient() {
  if (!litellmOpenAIClient && isLiteLLMEnabled() && process.env.LITELLM_OPENAI_API_KEY) {
    logger.info('[AI] getLiteLLMOpenAIClient() lazy init');
    initializeLiteLLMOpenAIClient();
  }
  return litellmOpenAIClient;
}

/**
 * Get the primary LiteLLM client (Gemini by default, for backward compatibility)
 * @returns {OpenAI|null} LiteLLM client or null
 */
function getLiteLLMClient() {
  return getLiteLLMGeminiClient() || getLiteLLMOpenAIClient();
}

/**
 * Get primary client based on current provider order
 * @returns {OpenAI|null} Primary client based on configuration
 */
function getClient() {
  const order = getProviderOrder();
  for (const providerId of order) {
    const config = getProviderConfig(providerId);
    if (config && config.client) {
      return config.client;
    }
  }
  // Fallback to any available client
  return getLiteLLMGeminiClient() || getLiteLLMOpenAIClient() || getFireworksClient();
}

/**
 * Check if AI analysis is enabled for screenshots (vision-based)
 * Controlled by USE_AI_FOR_SCREENSHOTS env var
 * @returns {boolean} True if any AI client is available and screenshot AI is enabled
 */
function isAIEnabled() {
  const hasClient = getFireworksClient() !== null || getLiteLLMClient() !== null;
  return hasClient && process.env.USE_AI_FOR_SCREENSHOTS !== 'false';
}

/**
 * Check if AI analysis is enabled for activity records (text-only)
 * Controlled by USE_AI_FOR_ACTIVITIES env var (defaults to enabled)
 * Separate from screenshot AI — activity analysis is text-only LLM matching
 * @returns {boolean} True if any AI client is available and activity AI is enabled
 */
function isActivityAIEnabled() {
  const hasClient = getFireworksClient() !== null || getLiteLLMClient() !== null;
  return hasClient && process.env.USE_AI_FOR_ACTIVITIES !== 'false';
}

/**
 * Get human-readable provider name
 * @param {string} providerId - Provider ID
 * @returns {string} Human-readable name
 */
function getProviderDisplayName(providerId) {
  const names = {
    'litellm-gemini': 'Gemini',
    'litellm-gpt4o': 'GPT-4o',
    'fireworks': 'Fireworks/Qwen'
  };
  return names[providerId] || providerId;
}

/**
 * Check and restore any demoted providers whose cooldown has expired
 */
function checkAndRestoreDemotedProviders() {
  const cooldownMs = getCooldownMinutes() * 60 * 1000;
  const now = Date.now();

  for (const [providerId, info] of Object.entries(providerState.demoted)) {
    const elapsed = now - info.demotedAt;
    if (elapsed >= cooldownMs) {
      // Cooldown complete, restore provider to its original position
      const currentIndex = providerState.order.indexOf(providerId);
      if (currentIndex !== -1) {
        providerState.order.splice(currentIndex, 1);
      }
      // Insert at original position (or beginning if original position is invalid)
      const targetIndex = Math.min(info.originalIndex, providerState.order.length);
      providerState.order.splice(targetIndex, 0, providerId);

      // Reset failure count and remove from demoted
      providerState.failures[providerId] = 0;
      delete providerState.demoted[providerId];

      const newPrimary = getProviderDisplayName(providerState.order[0]);
      logger.info('[AI] CIRCUIT BREAKER RESET - %s cooldown complete (%d min), restored to position %d',
        getProviderDisplayName(providerId), getCooldownMinutes(), targetIndex + 1);
      logger.info('[AI] Current provider order: %s', providerState.order.map(getProviderDisplayName).join(' -> '));
    }
  }
}

/**
 * Check if a specific provider is currently demoted
 * @param {string} providerId - Provider ID to check
 * @returns {boolean} True if provider is demoted
 */
function isProviderDemoted(providerId) {
  checkAndRestoreDemotedProviders(); // Check for any expired cooldowns first
  return providerId in providerState.demoted;
}

/**
 * Get the current provider order (with demoted providers moved to end)
 * @returns {string[]} Ordered list of provider IDs
 */
function getProviderOrder() {
  checkAndRestoreDemotedProviders();
  return [...providerState.order];
}

/**
 * Handle provider request failure
 * Tracks consecutive failures and demotes provider if threshold reached
 * @param {Error} error - The error that occurred
 * @param {string} providerId - The provider ID (litellm-gemini, litellm-gpt4o, fireworks)
 */
function handleProviderFailure(error, providerId) {
  providerState.failures[providerId] = (providerState.failures[providerId] || 0) + 1;
  const failures = providerState.failures[providerId];
  const threshold = getFailureThreshold();

  logger.warn('[AI] %s failed (%d/%d): %s',
    getProviderDisplayName(providerId), failures, threshold, error.message);

  if (failures >= threshold && !isProviderDemoted(providerId)) {
    // Demote this provider
    const currentIndex = providerState.order.indexOf(providerId);
    providerState.demoted[providerId] = {
      demotedAt: Date.now(),
      originalIndex: currentIndex
    };

    // Move provider to end of order
    if (currentIndex !== -1) {
      providerState.order.splice(currentIndex, 1);
      providerState.order.push(providerId);
    }

    const newPrimary = getProviderDisplayName(providerState.order[0]);
    logger.warn('[AI] CIRCUIT BREAKER ACTIVATED - %s demoted after %d failures',
      getProviderDisplayName(providerId), failures);
    logger.warn('[AI] %s is now PRIMARY for %d minutes',
      newPrimary, getCooldownMinutes());
    logger.info('[AI] New provider order: %s', providerState.order.map(getProviderDisplayName).join(' -> '));
  }
}

/**
 * Handle successful provider request
 * Resets failure counter for that provider
 * @param {string} providerId - The provider ID
 */
function handleProviderSuccess(providerId) {
  const previousFailures = providerState.failures[providerId] || 0;
  if (previousFailures > 0) {
    logger.info('[AI] %s recovered after %d failure(s)',
      getProviderDisplayName(providerId), previousFailures);
  }
  providerState.failures[providerId] = 0;
}

/**
 * Get remaining cooldown time for a demoted provider
 * @param {string} providerId - Provider ID
 * @returns {number} Minutes remaining, or 0 if not demoted
 */
function getRemainingCooldown(providerId) {
  if (!providerState.demoted[providerId]) return 0;
  const cooldownMs = getCooldownMinutes() * 60 * 1000;
  const elapsed = Date.now() - providerState.demoted[providerId].demotedAt;
  return Math.max(0, Math.ceil((cooldownMs - elapsed) / 60000));
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
 * Get the configured vision model (based on current primary provider)
 * @returns {string} Model name for vision analysis
 */
function getVisionModel() {
  const order = getProviderOrder();
  const primary = order[0];
  if (primary === 'fireworks') return getFireworksModel();
  if (primary === 'litellm-gemini') return getLiteLLMModel();
  if (primary === 'litellm-gpt4o') return getLiteLLMFallbackModel();
  return getLiteLLMModel();
}

/**
 * Get the configured text model (based on current primary provider)
 * @returns {string} Model name for text analysis
 */
function getTextModel() {
  return getVisionModel(); // Same logic
}

/**
 * Get default user identifier for LiteLLM tracking (fallback)
 * @returns {string} Default user email for usage tracking
 */
function getDefaultLiteLLMUser() {
  return process.env.LITELLM_USER || 'ai-server@amzur.com';
}

/**
 * Resolve the actual user email for LiteLLM tracking.
 * Looks up the user's email from the database by userId, with caching.
 * Falls back to the default static email if userId is not provided or lookup fails.
 * @param {string|null} userId - User ID to resolve
 * @returns {Promise<string>} User email for LiteLLM tracking
 */
async function resolveLiteLLMUser(userId) {
  if (!userId) return getDefaultLiteLLMUser();

  // Check cache first
  const cached = userEmailCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < USER_EMAIL_CACHE_TTL) {
    return cached.email;
  }

  try {
    const { getUserById } = require('../db/user-db-service');
    const user = await getUserById(userId);
    const email = user?.email || getDefaultLiteLLMUser();

    // Cache the result
    userEmailCache.set(userId, { email, timestamp: Date.now() });

    return email;
  } catch (error) {
    logger.warn('[AI] Failed to resolve user email for LiteLLM, using default: %s', error.message);
    return getDefaultLiteLLMUser();
  }
}

/**
 * Get current provider status for logging/monitoring
 * @returns {Object} Current AI provider status
 */
function getProviderStatus() {
  const order = getProviderOrder();
  return {
    fireworksEnabled: isFireworksEnabled(),
    litellmEnabled: isLiteLLMEnabled(),
    providerOrder: order,
    demotedProviders: Object.keys(providerState.demoted),
    failures: { ...providerState.failures },
    currentPrimary: order[0]
  };
}

/**
 * Get provider configuration (client, model, display name)
 * @param {string} providerId - Provider ID
 * @returns {Object|null} Provider config or null if not available
 */
function getProviderConfig(providerId) {
  switch (providerId) {
    case 'litellm-gemini':
      if (!isLiteLLMEnabled()) return null;
      return {
        client: getLiteLLMGeminiClient(),  // Uses LITELLM_GEMINI_API_KEY
        model: getLiteLLMModel(),
        displayName: 'Gemini',
        useLiteLLMUser: true
      };
    case 'litellm-gpt4o':
      if (!isLiteLLMEnabled()) return null;
      return {
        client: getLiteLLMOpenAIClient(),  // Uses LITELLM_OPENAI_API_KEY
        model: getLiteLLMFallbackModel(),
        displayName: 'GPT-4o',
        useLiteLLMUser: true
      };
    case 'fireworks':
      if (!isFireworksEnabled()) return null;
      return {
        client: getFireworksClient(),
        model: getFireworksModel(),
        displayName: 'Fireworks/Qwen',
        useLiteLLMUser: false
      };
    default:
      return null;
  }
}

/**
 * Execute a chat completion with dynamic fallback based on provider health.
 * Providers are tried in order, with unhealthy providers automatically demoted.
 *
 * @param {Object} params - Chat completion parameters
 * @param {Array} params.messages - Messages array
 * @param {number} params.temperature - Temperature setting (default: 0.3)
 * @param {number} params.max_tokens - Max tokens (default: 800)
 * @param {boolean} params.isVision - Whether this is a vision request (default: false)
 * @param {string} params.reasoningEffort - For Gemini: 'none'|'low'|'medium'|'high'; 'none' disables thinking so output tokens go to the response (optional)
 * @param {string} params.userId - User ID for cost tracking (optional)
 * @param {string} params.organizationId - Organization ID for cost tracking (optional)
 * @param {string} params.screenshotId - Screenshot ID for cost tracking (optional)
 * @returns {Promise<Object>} { response, provider, model }
 */
async function chatCompletionWithFallback({ messages, temperature = 0.3, max_tokens = 800, isVision = false, reasoningEffort = null, userId = null, organizationId = null, screenshotId = null }) {
  const errors = [];
  const requestType = isVision ? 'vision' : 'text';

  // Resolve the actual user email for LiteLLM tracking (once per request)
  const litellmUser = await resolveLiteLLMUser(userId);

  // Get current provider order (automatically checks for expired cooldowns)
  const providerOrder = getProviderOrder();

  // Log current provider order if any are demoted
  const demotedCount = Object.keys(providerState.demoted).length;
  if (demotedCount > 0) {
    const demotedNames = Object.keys(providerState.demoted).map(getProviderDisplayName).join(', ');
    logger.info('[AI] Provider order: %s (demoted: %s)',
      providerOrder.map(getProviderDisplayName).join(' -> '),
      demotedNames);
  }

  // Try each provider in order
  for (let i = 0; i < providerOrder.length; i++) {
    const providerId = providerOrder[i];
    
    // Skip demoted providers (they're in the order but shouldn't be tried)
    if (isProviderDemoted(providerId)) {
      continue;
    }
    
    const config = getProviderConfig(providerId);

    // Skip if provider not available
    if (!config || !config.client) continue;

    const isFirstAttempt = i === 0;
    const previousFailed = errors.length > 0;

    try {
      const startTime = Date.now();

      // Log which provider we're trying
      if (previousFailed) {
        const failedProviders = errors.map(e => getProviderDisplayName(e.provider)).join(', ');
        logger.info('[AI] %s request via %s (%s failed) (%s)',
          requestType, config.displayName, failedProviders, getShortModelName(config.model));
      } else {
        logger.info('[AI] %s request via %s (%s)',
          requestType, config.displayName, getShortModelName(config.model));
      }

      // Make the API call
      const requestParams = {
        model: config.model,
        messages,
        temperature,
        max_tokens
      };
      if (config.useLiteLLMUser) {
        requestParams.user = litellmUser;
      }
      // Disable Gemini thinking for text-only (e.g. OCR) so token budget goes to the JSON response
      if (reasoningEffort && providerId === 'litellm-gemini') {
        requestParams.reasoning_effort = reasoningEffort;
      }

      const response = await config.client.chat.completions.create(requestParams);

      const duration = Date.now() - startTime;

      // Success! Reset failure count for this provider
      handleProviderSuccess(providerId);

      logger.info('[AI] %s request completed | %s | %dms', requestType, config.displayName, duration);

      // Log to Google Sheets for Fireworks (async) - existing logging
      if (providerId === 'fireworks') {
        const usage = response.usage || {};
        logLLMRequest({
          apiCallName: requestType,
          provider: 'Fireworks',
          model: config.model,
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0
        }).catch(() => {});
      }

      // Log cost tracking to Sheet 2 for ALL providers (async)
      const usage = response.usage || {};
      logCostTracking({
        userId: userId,
        apiCallName: requestType,
        provider: providerId,
        model: config.model,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        duration: duration,
        organizationId: organizationId,
        screenshotId: screenshotId
      }).catch(() => {}); // Don't fail if cost tracking fails

      return { response, provider: providerId, model: config.model };

    } catch (error) {
      // Track failure and potentially demote provider
      handleProviderFailure(error, providerId);
      errors.push({ provider: providerId, error: error.message });

      // Continue to next provider in order
    }
  }

  // All providers failed
  const errorMsg = errors.map(e => `${getProviderDisplayName(e.provider)}: ${e.error}`).join('; ');
  logger.error('[AI] All providers failed: %s', errorMsg);
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
  isActivityAIEnabled,
  isFireworksEnabled,
  isLiteLLMEnabled,
  getProviderStatus,
  getProviderOrder,
  isProviderDemoted,

  // Model getters
  getVisionModel,
  getTextModel,
  getFireworksModel,
  getLiteLLMModel,
  getLiteLLMFallbackModel,
  getLiteLLMUser: getDefaultLiteLLMUser,
  resolveLiteLLMUser,

  // Main request function with fallback
  chatCompletionWithFallback
};
