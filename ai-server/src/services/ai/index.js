/**
 * AI Services Module - Re-exports
 * Provides a single entry point for all AI-related services
 */

const openaiClient = require('./openai-client');
const prompts = require('./prompts');
const visionAnalyzer = require('./vision-analyzer');
const ocrAnalyzer = require('./ocr-analyzer');

module.exports = {
  // OpenAI Client
  initializeClient: openaiClient.initializeClient,
  getClient: openaiClient.getClient,
  isAIEnabled: openaiClient.isAIEnabled,
  getVisionModel: openaiClient.getVisionModel,
  getTextModel: openaiClient.getTextModel,

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
