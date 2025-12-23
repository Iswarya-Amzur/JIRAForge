/**
 * AI Services Module - Re-exports
 * Provides a single entry point for all AI-related services
 * Supports LiteLLM primary with automatic OpenAI fallback
 */

const openaiClient = require('./openai-client');
const prompts = require('./prompts');
const visionAnalyzer = require('./vision-analyzer');
const ocrAnalyzer = require('./ocr-analyzer');

module.exports = {
  // OpenAI/LiteLLM Client
  initializeClient: openaiClient.initializeClient,
  getClient: openaiClient.getClient,
  getLiteLLMClient: openaiClient.getLiteLLMClient,
  getOpenAIClient: openaiClient.getOpenAIClient,
  isAIEnabled: openaiClient.isAIEnabled,
  isLiteLLMEnabled: openaiClient.isLiteLLMEnabled,
  shouldUseFallback: openaiClient.shouldUseFallback,
  getProviderStatus: openaiClient.getProviderStatus,

  // Model getters
  getVisionModel: openaiClient.getVisionModel,
  getTextModel: openaiClient.getTextModel,
  getLiteLLMModel: openaiClient.getLiteLLMModel,
  getOpenAIVisionModel: openaiClient.getOpenAIVisionModel,
  getOpenAITextModel: openaiClient.getOpenAITextModel,
  getLiteLLMUser: openaiClient.getLiteLLMUser,

  // Main request function with fallback
  chatCompletionWithFallback: openaiClient.chatCompletionWithFallback,

  // Prompts
  VISION_SYSTEM_PROMPT: prompts.VISION_SYSTEM_PROMPT,
  OCR_SYSTEM_PROMPT: prompts.OCR_SYSTEM_PROMPT,
  buildVisionUserPrompt: prompts.buildVisionUserPrompt,
  buildOCRUserPrompt: prompts.buildOCRUserPrompt,
  formatAssignedIssues: prompts.formatAssignedIssues,

  // Vision Analyzer
  analyzeWithVision: visionAnalyzer.analyzeWithVision,
  parseAIResponse: visionAnalyzer.parseAIResponse,
  validateAndFormatResult: visionAnalyzer.validateAndFormatResult,

  // OCR Analyzer
  extractText: ocrAnalyzer.extractText,
  analyzeWithOCR: ocrAnalyzer.analyzeWithOCR,
  analyzeWithOCRPipeline: ocrAnalyzer.analyzeWithOCRPipeline
};
