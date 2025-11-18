const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const axios = require('axios');
const OpenAI = require('openai');
const logger = require('../utils/logger');

// Initialize OpenAI client if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Extract text from screenshot using OCR
 */
exports.extractText = async (imageBuffer) => {
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
};

/**
 * Analyze activity and determine Jira task with AI enhancement
 */
exports.analyzeActivity = async ({ extractedText, windowTitle, applicationName, timestamp, userId }) => {
  try {
    // Extract potential Jira issue keys from text and window title
    const detectedJiraKeys = extractJiraKeys(extractedText, windowTitle);

    // Calculate time spent (based on screenshot interval)
    const timeSpentSeconds = parseInt(process.env.SCREENSHOT_INTERVAL || '300');

    // Use AI for enhanced analysis if OpenAI is available
    let aiAnalysis = null;
    let useAI = openai !== null && process.env.USE_AI_FOR_SCREENSHOTS !== 'false';

    if (useAI) {
      try {
        aiAnalysis = await analyzeWithAI({
          extractedText,
          windowTitle,
          applicationName,
          detectedJiraKeys
        });
        logger.info('AI analysis completed', {
          taskKey: aiAnalysis.taskKey,
          confidence: aiAnalysis.confidenceScore,
          isActiveWork: aiAnalysis.isActiveWork
        });
      } catch (aiError) {
        logger.warn('AI analysis failed, falling back to heuristics', { error: aiError.message });
        // Fall back to heuristic-based analysis
      }
    }

    // Determine if this is active work or idle time
    let isIdle = false;
    let isActiveWork = false;

    if (aiAnalysis) {
      // Use AI results
      isIdle = aiAnalysis.isIdle;
      isActiveWork = aiAnalysis.isActiveWork;
    } else {
      // Fallback to heuristic-based classification
      isIdle = checkIfIdle(applicationName, windowTitle, extractedText);
      isActiveWork = !isIdle && isWorkRelated(applicationName, windowTitle);
    }

    // Determine the most likely task based on context
    let taskKey = null;
    let projectKey = null;
    let confidenceScore = 0;
    let modelVersion = 'v1.0-tesseract';

    if (detectedJiraKeys.length > 0) {
      // If we found Jira keys in the screenshot, use the first one
      taskKey = detectedJiraKeys[0];
      projectKey = taskKey.split('-')[0];
      confidenceScore = 0.9; // High confidence when we find explicit Jira keys
      modelVersion = aiAnalysis ? 'v2.0-ai-enhanced' : 'v1.0-tesseract';
    } else if (aiAnalysis && aiAnalysis.taskKey) {
      // Use AI-inferred task
      taskKey = aiAnalysis.taskKey;
      projectKey = aiAnalysis.projectKey;
      confidenceScore = aiAnalysis.confidenceScore;
      modelVersion = 'v2.0-ai-enhanced';
    } else if (isActiveWork) {
      // Try to infer task from window title or application context using heuristics
      const inferredTask = await inferTaskFromContext({
        windowTitle,
        applicationName,
        extractedText,
        userId
      });

      if (inferredTask) {
        taskKey = inferredTask.key;
        projectKey = inferredTask.project;
        confidenceScore = inferredTask.confidence;
      }
    }

    return {
      taskKey,
      projectKey,
      timeSpentSeconds,
      confidenceScore,
      detectedJiraKeys,
      isActiveWork,
      isIdle,
      modelVersion,
      metadata: {
        application: applicationName,
        windowTitle,
        hasText: extractedText.length > 0,
        textLength: extractedText.length,
        aiEnhanced: !!aiAnalysis,
        aiAnalysisUsed: useAI
      }
    };
  } catch (error) {
    logger.error('Activity analysis error:', error);
    throw new Error(`Failed to analyze activity: ${error.message}`);
  }
};

/**
 * Extract Jira issue keys from text (e.g., PROJ-123)
 */
function extractJiraKeys(text, windowTitle = '') {
  const jiraKeyPattern = /\b([A-Z]{2,10}-\d+)\b/g;
  const combinedText = `${text} ${windowTitle}`;

  const matches = combinedText.match(jiraKeyPattern);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Check if the activity is idle time
 */
function checkIfIdle(appName, windowTitle, text) {
  const idleIndicators = [
    'lock screen',
    'screensaver',
    'idle',
    'away',
    'afk'
  ];

  const combined = `${appName} ${windowTitle} ${text}`.toLowerCase();

  return idleIndicators.some(indicator => combined.includes(indicator));
}

/**
 * Check if activity is work-related
 */
function isWorkRelated(appName, windowTitle) {
  const workApps = [
    'visual studio code',
    'intellij',
    'pycharm',
    'eclipse',
    'sublime',
    'atom',
    'chrome',
    'firefox',
    'edge',
    'terminal',
    'iterm',
    'git',
    'slack',
    'teams',
    'zoom',
    'jira',
    'confluence',
    'postman',
    'docker'
  ];

  const nonWorkIndicators = [
    'youtube',
    'netflix',
    'spotify',
    'facebook',
    'twitter',
    'instagram',
    'reddit',
    'game'
  ];

  const combined = `${appName} ${windowTitle}`.toLowerCase();

  // Check if it's a known non-work activity
  if (nonWorkIndicators.some(indicator => combined.includes(indicator))) {
    return false;
  }

  // Check if it's a known work app
  return workApps.some(app => combined.includes(app));
}

/**
 * Analyze screenshot context using OpenAI for better task detection
 */
async function analyzeWithAI({ extractedText, windowTitle, applicationName, detectedJiraKeys }) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  const prompt = `You are analyzing a screenshot to determine what Jira task the user is working on.

Context:
- Application: ${applicationName}
- Window Title: ${windowTitle}
- Extracted Text (from OCR): ${extractedText.substring(0, 1000)}${extractedText.length > 1000 ? '...' : ''}
- Detected Jira Keys: ${detectedJiraKeys.length > 0 ? detectedJiraKeys.join(', ') : 'None found'}

Analyze this information and determine:
1. Is this active work or idle time? (Consider: lock screens, screensavers, non-work apps like YouTube/Netflix)
2. What Jira task key (format: PROJECT-123) is the user most likely working on?
3. What is the project key?
4. Confidence score (0.0 to 1.0) for your assessment

Rules:
- If explicit Jira keys are found, use those with high confidence (0.9+)
- If no explicit keys, infer from context (window title, application, text content)
- Mark as idle if it's clearly non-work (lock screen, entertainment, etc.)
- Mark as active work if it's a development tool, Jira, Confluence, or work-related application
- Return ONLY valid JSON in this exact format:
{
  "isActiveWork": true/false,
  "isIdle": true/false,
  "taskKey": "PROJECT-123" or null,
  "projectKey": "PROJECT" or null,
  "confidenceScore": 0.0-1.0,
  "reasoning": "Brief explanation of your analysis"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing work activity from screenshots. You identify Jira tasks and determine if work is active or idle.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent, factual results
      max_tokens: 300
    });

    const content = response.choices[0].message.content.trim();
    
    // Try to parse JSON from the response
    let aiResult;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      aiResult = JSON.parse(jsonString);
    } catch (parseError) {
      // If JSON parsing fails, try to extract key information
      logger.warn('Failed to parse AI response as JSON, attempting fallback', { content });
      throw new Error('Invalid JSON response from AI');
    }

    // Validate and return AI analysis
    return {
      isActiveWork: aiResult.isActiveWork === true,
      isIdle: aiResult.isIdle === true,
      taskKey: aiResult.taskKey || null,
      projectKey: aiResult.projectKey || null,
      confidenceScore: Math.min(Math.max(aiResult.confidenceScore || 0.5, 0), 1), // Clamp between 0 and 1
      reasoning: aiResult.reasoning || ''
    };
  } catch (error) {
    logger.error('OpenAI analysis error:', error);
    throw error;
  }
}

/**
 * Infer task from context using heuristics (fallback when AI is not available)
 */
async function inferTaskFromContext({ windowTitle, applicationName, extractedText, userId }) {
  // Heuristic-based inference (fallback)
  // This could be enhanced with:
  // - Recent tasks from user's Jira
  // - Pattern matching on window titles
  // - User's working hours and typical tasks

  // For now, return null - AI should handle this
  return null;
}

/**
 * Create worklog in Jira via Forge app
 */
exports.createWorklog = async ({ userId, issueKey, timeSpentSeconds, startedAt }) => {
  try {
    // This would call the Forge app's API to create a worklog
    // For now, log the action
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
