/**
 * Screenshot Service
 * Main service for screenshot analysis - orchestrates AI-based analysis
 *
 * Refactored to use modular AI services:
 * - ai/openai-client.js - OpenAI client management
 * - ai/prompts.js - AI prompts
 * - ai/vision-analyzer.js - GPT-4 Vision analysis
 * - ai/ocr-analyzer.js - OCR + GPT-4 text analysis
 */

const logger = require('../utils/logger');
const { isAIEnabled, analyzeWithVision, analyzeWithOCRPipeline } = require('./ai');

/**
 * Analyze activity using AI (GPT-4 Vision primary, OCR fallback)
 *
 * @param {Object} params - Analysis parameters
 * @param {Buffer} params.imageBuffer - Screenshot image buffer
 * @param {string} params.windowTitle - Window title
 * @param {string} params.applicationName - Application name
 * @param {string} params.timestamp - Timestamp of the screenshot
 * @param {string} params.userId - User ID
 * @param {Array} params.userAssignedIssues - User's assigned Jira issues
 * @returns {Promise<Object>} Analysis result
 */
exports.analyzeActivity = async ({ imageBuffer, windowTitle, applicationName, timestamp, userId, userAssignedIssues = [] }) => {
  try {
    // Calculate time spent (based on screenshot interval)
    const timeSpentSeconds = parseInt(process.env.SCREENSHOT_INTERVAL || '300');

    // Use GPT-4 Vision as primary analysis method
    let visionAnalysis = null;
    const useVision = isAIEnabled();

    if (useVision && imageBuffer) {
      try {
        visionAnalysis = await analyzeWithVision({
          imageBuffer,
          windowTitle,
          applicationName,
          userAssignedIssues
        });
        logger.info('GPT-4 Vision analysis completed', {
          taskKey: visionAnalysis.taskKey,
          workType: visionAnalysis.workType,
          confidence: visionAnalysis.confidenceScore,
          usedAssignedIssues: userAssignedIssues.length > 0,
          assignedIssuesCount: userAssignedIssues.length,
          assignedIssueKeys: userAssignedIssues.map(i => i.key).join(', '),
          reasoning: visionAnalysis.reasoning || 'No reasoning provided'
        });
      } catch (visionError) {
        logger.warn('GPT-4 Vision analysis failed, falling back to OCR + AI', { error: visionError.message });
        // Fall back to OCR-based analysis
      }
    }

    // If Vision analysis failed or not available, fall back to OCR + GPT-4 text
    if (!visionAnalysis && imageBuffer) {
      logger.info('Falling back to OCR-based analysis');
      try {
        visionAnalysis = await analyzeWithOCRPipeline({
          imageBuffer,
          windowTitle,
          applicationName,
          userAssignedIssues
        });
        logger.info('OCR + AI analysis completed', {
          taskKey: visionAnalysis.taskKey,
          workType: visionAnalysis.workType,
          confidence: visionAnalysis.confidenceScore
        });
      } catch (aiError) {
        logger.error('Both Vision and OCR+AI analysis failed', { error: aiError.message });
        // Last fallback: basic heuristics - default to office work with no specific task
        visionAnalysis = {
          taskKey: null,
          projectKey: null,
          workType: 'office',
          confidenceScore: 0.3,
          reasoning: 'Fallback to basic heuristics - AI analysis failed',
          extractedText: ''
        };
      }
    }

    // Extract final results
    const taskKey = visionAnalysis?.taskKey || null;
    const projectKey = visionAnalysis?.projectKey || (taskKey ? taskKey.split('-')[0] : null);
    const workType = visionAnalysis?.workType || 'office';
    const confidenceScore = visionAnalysis?.confidenceScore || 0.0;

    return {
      taskKey,
      projectKey,
      timeSpentSeconds,
      confidenceScore,
      workType,
      modelVersion: visionAnalysis?.modelVersion || 'v3.1-vision-thorough',
      metadata: {
        application: applicationName,
        windowTitle,
        aiEnhanced: true,
        usedVision: !!visionAnalysis,
        assignedIssuesCount: userAssignedIssues.length,
        usedAssignedIssues: userAssignedIssues.length > 0,
        reasoning: visionAnalysis?.reasoning || '',
        extractedText: visionAnalysis?.extractedText || ''
      }
    };
  } catch (error) {
    logger.error('Activity analysis error:', error);
    throw new Error(`Failed to analyze activity: ${error.message}`);
  }
};

/**
 * Create worklog in Jira via Forge app
 *
 * @param {Object} params - Worklog parameters
 * @param {string} params.userId - User ID
 * @param {string} params.issueKey - Jira issue key
 * @param {number} params.timeSpentSeconds - Time spent in seconds
 * @param {string} params.startedAt - Start timestamp
 * @returns {Promise<Object>} Worklog creation result
 */
exports.createWorklog = async ({ userId, issueKey, timeSpentSeconds, startedAt }) => {
  try {
    logger.info('Worklog creation requested', {
      userId,
      issueKey,
      timeSpentSeconds,
      startedAt
    });

    // In production, this would make an API call to the Forge app
    // which would then use the Jira API to create the worklog
    /*
    const response = await axios.post(
      `${process.env.FORGE_APP_URL}/api/create-worklog`,
      {
        userId,
        issueKey,
        timeSpentSeconds,
        startedAt
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.FORGE_API_KEY}`
        }
      }
    );

    return response.data;
    */

    // Placeholder response
    return { worklogId: 'placeholder', created: true };
  } catch (error) {
    logger.error('Worklog creation error:', error);
    throw new Error(`Failed to create worklog: ${error.message}`);
  }
};
