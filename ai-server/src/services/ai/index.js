/**
 * AI Services Module - Re-exports
 * Provides a single entry point for all AI-related services
 * Supports Portkey (Gemini) primary with automatic Fireworks fallback
 */

const aiClient = require('./ai-client');
const prompts = require('./prompts');
const visionAnalyzer = require('./vision-analyzer');
const ocrAnalyzer = require('./ocr-analyzer');

module.exports = {
  // AI Client (Portkey + Fireworks)
  initializeClient: aiClient.initializeClient,
  getClient: aiClient.getClient,
  getFireworksClient: aiClient.getFireworksClient,
  getPortkeyClient: aiClient.getPortkeyClient,
  isAIEnabled: aiClient.isAIEnabled,
  isFireworksEnabled: aiClient.isFireworksEnabled,
  isPortkeyEnabled: aiClient.isPortkeyEnabled,
  getProviderOrder: aiClient.getProviderOrder,
  isProviderDemoted: aiClient.isProviderDemoted,
  getProviderStatus: aiClient.getProviderStatus,

  // Model getters
  getVisionModel: aiClient.getVisionModel,
  getTextModel: aiClient.getTextModel,
  getFireworksModel: aiClient.getFireworksModel,
  getPortkeyModel: aiClient.getPortkeyModel,

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
