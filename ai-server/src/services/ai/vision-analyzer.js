/**
 * Vision Analyzer Module
 * Handles GPT-4 Vision-based screenshot analysis
 */

const { getClient, getVisionModel } = require('./openai-client');
const { VISION_SYSTEM_PROMPT, buildVisionUserPrompt, formatAssignedIssues } = require('./prompts');
const logger = require('../../utils/logger');

/**
 * Analyze screenshot using GPT-4 Vision API
 * This is the PRIMARY analysis method - analyzes image directly
 *
 * @param {Object} params - Analysis parameters
 * @param {Buffer} params.imageBuffer - Screenshot image buffer
 * @param {string} params.windowTitle - Window title
 * @param {string} params.applicationName - Application name
 * @param {Array} params.userAssignedIssues - User's assigned Jira issues
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeWithVision({ imageBuffer, windowTitle, applicationName, userAssignedIssues = [] }) {
  const openai = getClient();

  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Convert image buffer to base64
  const base64Image = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/png;base64,${base64Image}`;

  // Format assigned issues for the prompt
  const assignedIssuesText = formatAssignedIssues(userAssignedIssues);

  // Build the prompt
  const userPrompt = buildVisionUserPrompt(applicationName, windowTitle, assignedIssuesText);

  try {
    const response = await openai.chat.completions.create({
      model: getVisionModel(),
      messages: [
        {
          role: 'system',
          content: VISION_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
                detail: 'high' // Use high detail for better analysis
              }
            }
          ]
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 800   // Enough for detailed content analysis
    });

    const content = response.choices[0].message.content.trim();

    // Parse JSON from the response
    const aiResult = parseAIResponse(content);

    // Validate and return the result
    return validateAndFormatResult(aiResult, userAssignedIssues);

  } catch (error) {
    logger.error('GPT-4 Vision analysis error:', error);
    throw error;
  }
}

/**
 * Parse AI response and extract JSON
 * @param {string} content - Raw AI response content
 * @returns {Object} Parsed JSON object
 */
function parseAIResponse(content) {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                      content.match(/```\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;
    return JSON.parse(jsonString);
  } catch (parseError) {
    logger.warn('Failed to parse AI response as JSON', { content: content.substring(0, 200) });
    throw new Error('Invalid JSON response from AI');
  }
}

/**
 * Validate AI result and format the response
 * @param {Object} aiResult - Parsed AI result
 * @param {Array} userAssignedIssues - User's assigned issues for validation
 * @returns {Object} Validated and formatted result
 */
function validateAndFormatResult(aiResult, userAssignedIssues) {
  // Validate work_type
  if (aiResult.workType !== 'office' && aiResult.workType !== 'non-office') {
    logger.warn('Invalid work_type from AI, defaulting to office', { workType: aiResult.workType });
    aiResult.workType = 'office';
  }

  // Validate task key is in user's assigned issues (if provided)
  let validatedTaskKey = aiResult.taskKey || null;

  if (validatedTaskKey && userAssignedIssues && userAssignedIssues.length > 0) {
    const assignedIssueKeys = userAssignedIssues.map(issue => issue.key);
    if (!assignedIssueKeys.includes(validatedTaskKey)) {
      logger.warn('AI returned task key not in assigned issues, setting to null', {
        aiTaskKey: validatedTaskKey,
        assignedKeys: assignedIssueKeys
      });
      validatedTaskKey = null;
    }
  }

  // Return validated analysis
  return {
    workType: aiResult.workType,
    taskKey: validatedTaskKey,
    projectKey: aiResult.projectKey || (validatedTaskKey ? validatedTaskKey.split('-')[0] : null),
    confidenceScore: Math.min(Math.max(aiResult.confidenceScore || 0.5, 0), 1), // Clamp between 0 and 1
    contentAnalysis: aiResult.contentAnalysis || '',
    reasoning: aiResult.reasoning || '',
    modelVersion: 'v3.1-vision-thorough'
  };
}

module.exports = {
  analyzeWithVision,
  parseAIResponse,
  validateAndFormatResult
};
