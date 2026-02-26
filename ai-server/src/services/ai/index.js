/**
 * AI Services Module - Re-exports
 * Provides a single entry point for all AI-related services
 * Supports Fireworks AI primary with automatic LiteLLM fallback
 */

const aiClient = require('./ai-client');
const prompts = require('./prompts');
const visionAnalyzer = require('./vision-analyzer');
const ocrAnalyzer = require('./ocr-analyzer');

module.exports = {
  // AI Client (Fireworks + LiteLLM)
  initializeClient: aiClient.initializeClient,
  getClient: aiClient.getClient,
  getFireworksClient: aiClient.getFireworksClient,
  getLiteLLMClient: aiClient.getLiteLLMClient,
  isAIEnabled: aiClient.isAIEnabled,
  isFireworksEnabled: aiClient.isFireworksEnabled,
  isLiteLLMEnabled: aiClient.isLiteLLMEnabled,
  getProviderOrder: aiClient.getProviderOrder,
  isProviderDemoted: aiClient.isProviderDemoted,
  getProviderStatus: aiClient.getProviderStatus,

  // Model getters
  getVisionModel: aiClient.getVisionModel,
  getTextModel: aiClient.getTextModel,
  getFireworksModel: aiClient.getFireworksModel,
  getLiteLLMModel: aiClient.getLiteLLMModel,
  getLiteLLMUser: aiClient.getLiteLLMUser,
  resolveLiteLLMUser: aiClient.resolveLiteLLMUser,

  // Main request function with fallback
  chatCompletionWithFallback: aiClient.chatCompletionWithFallback,

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
