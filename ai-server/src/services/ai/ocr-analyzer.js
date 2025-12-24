/**
 * OCR Analyzer Module
 * Handles OCR text extraction and AI text-based analysis (fallback method)
 * Supports Fireworks AI primary with automatic LiteLLM fallback
 */

const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { chatCompletionWithFallback, isAIEnabled } = require('./ai-client');
const { OCR_SYSTEM_PROMPT, buildOCRUserPrompt, formatAssignedIssues } = require('./prompts');
const { parseAIResponse, validateAndFormatResult } = require('./vision-analyzer');
const logger = require('../../utils/logger');

/**
 * Extract text from screenshot using Tesseract OCR
 *
 * @param {Buffer} imageBuffer - Screenshot image buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractText(imageBuffer) {
  try {
    // Preprocess image for better OCR results
    const processedImage = await sharp(imageBuffer)
      .greyscale()
      .normalize()
      .toBuffer();

    // Perform OCR
    const { data: { text } } = await Tesseract.recognize(
      processedImage,
      'eng',
      {
        logger: info => {
          if (info.status === 'recognizing text') {
            logger.debug(`OCR progress: ${(info.progress * 100).toFixed(0)}%`);
          }
        }
      }
    );

    return text.trim();
  } catch (error) {
    logger.error('[AI] OCR extraction failed: %s', error.message);
    throw new Error(`Failed to extract text from screenshot: ${error.message}`);
  }
}

/**
 * Analyze screenshot using AI text model with OCR (fallback method)
 * Uses Fireworks AI as primary, falls back to LiteLLM on consecutive failures
 *
 * @param {Object} params - Analysis parameters
 * @param {string} params.extractedText - OCR extracted text
 * @param {string} params.windowTitle - Window title
 * @param {string} params.applicationName - Application name
 * @param {Array} params.userAssignedIssues - User's assigned Jira issues
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeWithOCR({ extractedText, windowTitle, applicationName, userAssignedIssues = [] }) {
  if (!isAIEnabled()) {
    throw new Error('AI client not initialized - check API keys');
  }

  // Format assigned issues for the prompt
  const assignedIssuesText = formatAssignedIssues(userAssignedIssues);

  // Build the prompt
  const userPrompt = buildOCRUserPrompt(applicationName, windowTitle, extractedText, assignedIssuesText);

  // Build messages array
  const messages = [
    {
      role: 'system',
      content: OCR_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: userPrompt
    }
  ];

  try {
    // Use unified request with automatic fallback
    const { response, provider, model } = await chatCompletionWithFallback({
      messages,
      temperature: 0.3,
      max_tokens: 300,
      isVision: false
    });

    const content = response.choices[0].message.content.trim();
    logger.info('[AI] OCR analysis done | %s (%s)', provider, model);

    // Parse JSON from the response
    const aiResult = parseAIResponse(content);

    // Validate and format result
    const result = validateAndFormatResult(aiResult, userAssignedIssues);

    // Override model version for OCR-based analysis with provider info
    result.modelVersion = 'v2.1-ocr-ai';
    result.aiProvider = provider;
    result.aiModel = model;

    // Log analysis result
    logger.info('[AI] Result: %s | task: %s | confidence: %d%% | %s',
      result.workType,
      result.taskKey || 'none',
      Math.round(result.confidenceScore * 100),
      result.reasoning?.substring(0, 80) || 'no reasoning'
    );

    return result;

  } catch (error) {
    logger.error('[AI] OCR + AI analysis failed: %s', error.message);
    throw error;
  }
}

/**
 * Perform complete OCR-based analysis pipeline
 * Extracts text and then analyzes it with AI
 *
 * @param {Object} params - Analysis parameters
 * @param {Buffer} params.imageBuffer - Screenshot image buffer
 * @param {string} params.windowTitle - Window title
 * @param {string} params.applicationName - Application name
 * @param {Array} params.userAssignedIssues - User's assigned Jira issues
 * @returns {Promise<Object>} Analysis result with extractedText included
 */
async function analyzeWithOCRPipeline({ imageBuffer, windowTitle, applicationName, userAssignedIssues = [] }) {
  // Step 1: Extract text from image
  const extractedText = await extractText(imageBuffer);

  // Step 2: Analyze extracted text with AI
  const result = await analyzeWithOCR({
    extractedText,
    windowTitle,
    applicationName,
    userAssignedIssues
  });

  // Add extracted text to result
  result.extractedText = extractedText;

  return result;
}

module.exports = {
  extractText,
  analyzeWithOCR,
  analyzeWithOCRPipeline
};
