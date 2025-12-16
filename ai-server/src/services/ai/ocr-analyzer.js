/**
 * OCR Analyzer Module
 * Handles OCR text extraction and GPT-4 text-based analysis (fallback method)
 */

const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { getClient, getTextModel } = require('./openai-client');
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
    logger.error('OCR extraction error:', error);
    throw new Error(`Failed to extract text from screenshot: ${error.message}`);
  }
}

/**
 * Analyze screenshot using GPT-4 text model with OCR (fallback method)
 *
 * @param {Object} params - Analysis parameters
 * @param {string} params.extractedText - OCR extracted text
 * @param {string} params.windowTitle - Window title
 * @param {string} params.applicationName - Application name
 * @param {Array} params.userAssignedIssues - User's assigned Jira issues
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeWithOCR({ extractedText, windowTitle, applicationName, userAssignedIssues = [] }) {
  const openai = getClient();

  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Format assigned issues for the prompt
  const assignedIssuesText = formatAssignedIssues(userAssignedIssues);

  // Build the prompt
  const userPrompt = buildOCRUserPrompt(applicationName, windowTitle, extractedText, assignedIssuesText);

  try {
    const response = await openai.chat.completions.create({
      model: getTextModel(),
      messages: [
        {
          role: 'system',
          content: OCR_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const content = response.choices[0].message.content.trim();

    // Parse JSON from the response
    const aiResult = parseAIResponse(content);

    // Validate and format result
    const result = validateAndFormatResult(aiResult, userAssignedIssues);

    // Override model version for OCR-based analysis
    result.modelVersion = 'v2.1-ocr-ai';

    return result;

  } catch (error) {
    logger.error('OCR + AI analysis error:', error);
    throw error;
  }
}

/**
 * Perform complete OCR-based analysis pipeline
 * Extracts text and then analyzes it with GPT-4
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
