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
 * Analyze activity using GPT-4 Vision (primary method)
 * This analyzes the screenshot image directly without OCR
 */
exports.analyzeActivity = async ({ imageBuffer, windowTitle, applicationName, timestamp, userId, userAssignedIssues = [] }) => {
  try {
    // Calculate time spent (based on screenshot interval)
    const timeSpentSeconds = parseInt(process.env.SCREENSHOT_INTERVAL || '300');

    // Use GPT-4 Vision as primary analysis method
    let visionAnalysis = null;
    let useVision = openai !== null && process.env.USE_AI_FOR_SCREENSHOTS !== 'false';

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
          usedAssignedIssues: userAssignedIssues.length > 0
        });
      } catch (visionError) {
        logger.warn('GPT-4 Vision analysis failed, falling back to OCR + AI', { error: visionError.message });
        // Fall back to OCR-based analysis
      }
    }

    // If Vision analysis failed or not available, fall back to OCR + GPT-4 text
    if (!visionAnalysis && imageBuffer) {
      logger.info('Falling back to OCR-based analysis');
      const extractedText = await extractText(imageBuffer);

      // Extract potential Jira issue keys from text and window title
      const detectedJiraKeys = extractJiraKeys(extractedText, windowTitle);

      // Filter detected keys to only include user's assigned issues
      let validDetectedKeys = detectedJiraKeys;
      if (userAssignedIssues && userAssignedIssues.length > 0) {
        const assignedIssueKeys = userAssignedIssues.map(issue => issue.key);
        validDetectedKeys = detectedJiraKeys.filter(key => assignedIssueKeys.includes(key));

        if (detectedJiraKeys.length > 0 && validDetectedKeys.length === 0) {
          logger.warn('Detected Jira keys not in user\'s assigned issues', {
            detectedKeys: detectedJiraKeys,
            assignedKeys: assignedIssueKeys
          });
        }
      }

      // Use AI for enhanced analysis
      try {
        visionAnalysis = await analyzeWithAI({
          extractedText,
          windowTitle,
          applicationName,
          detectedJiraKeys: validDetectedKeys,
          userAssignedIssues
        });
        logger.info('OCR + AI analysis completed', {
          taskKey: visionAnalysis.taskKey,
          workType: visionAnalysis.workType,
          confidence: visionAnalysis.confidenceScore
        });
        // Add extracted text to metadata for storage
        visionAnalysis.extractedText = extractedText;
      } catch (aiError) {
        logger.error('Both Vision and OCR+AI analysis failed', { error: aiError.message });
        // Last fallback: basic heuristics
        visionAnalysis = {
          taskKey: validDetectedKeys.length > 0 ? validDetectedKeys[0] : null,
          projectKey: validDetectedKeys.length > 0 ? validDetectedKeys[0].split('-')[0] : null,
          workType: 'office', // Default to office work
          confidenceScore: validDetectedKeys.length > 0 ? 0.7 : 0.3,
          detectedJiraKeys: validDetectedKeys,
          reasoning: 'Fallback to basic heuristics',
          extractedText
        };
      }
    }

    // Extract final results
    const taskKey = visionAnalysis?.taskKey || null;
    const projectKey = visionAnalysis?.projectKey || (taskKey ? taskKey.split('-')[0] : null);
    const workType = visionAnalysis?.workType || 'office';
    const confidenceScore = visionAnalysis?.confidenceScore || 0.0;
    const detectedJiraKeys = visionAnalysis?.detectedJiraKeys || [];

    return {
      taskKey,
      projectKey,
      timeSpentSeconds,
      confidenceScore,
      detectedJiraKeys,
      workType, // 'office' or 'non-office'
      modelVersion: visionAnalysis?.modelVersion || 'v3.0-vision',
      metadata: {
        application: applicationName,
        windowTitle,
        aiEnhanced: true,
        usedVision: !!visionAnalysis,
        assignedIssuesCount: userAssignedIssues.length,
        usedAssignedIssues: userAssignedIssues.length > 0,
        reasoning: visionAnalysis?.reasoning || '',
        extractedText: visionAnalysis?.extractedText || '' // Store OCR text if fallback was used
      }
    };
  } catch (error) {
    logger.error('Activity analysis error:', error);
    throw new Error(`Failed to analyze activity: ${error.message}`);
  }
};

/**
 * Analyze screenshot using GPT-4 Vision API
 * This is the PRIMARY analysis method - analyzes image directly
 */
async function analyzeWithVision({ imageBuffer, windowTitle, applicationName, userAssignedIssues = [] }) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Convert image buffer to base64
  const base64Image = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/png;base64,${base64Image}`;

  // Build user's assigned issues list for the prompt
  let assignedIssuesText = 'None - track all work';
  if (userAssignedIssues && userAssignedIssues.length > 0) {
    assignedIssuesText = userAssignedIssues
      .slice(0, 20) // Limit to first 20 issues to avoid token limits
      .map(issue => `- ${issue.key}: ${issue.summary} (Status: ${issue.status})`)
      .join('\n');
  }

  const prompt = `You are analyzing a screenshot to determine:
1. What Jira task the user is working on (if any)
2. Whether this is office work or non-office work

Context:
- Application: ${applicationName}
- Window Title: ${windowTitle}

User's Assigned Issues (from Jira):
${assignedIssuesText}

Analyze the screenshot and determine:

1. **Work Type Classification:**
   - 'office': Work-related activities including:
     * Coding, development, debugging
     * Jira, project management tools
     * Documentation, technical writing
     * Meetings, Slack, Teams, Zoom
     * Work-related research (Stack Overflow, documentation, work-related YouTube tutorials)
     * Email, calendar, work communication
   - 'non-office': Personal/non-work activities including:
     * Entertainment (Netflix, personal YouTube, gaming)
     * Social media (Facebook, Twitter, Instagram - unless for work)
     * Personal browsing, shopping
     * Any clearly non-work-related activity

2. **Task Detection:**
   - Look for Jira issue keys in the screenshot (format: PROJECT-123)
   - Match the screenshot content to the user's assigned issues
   - Consider: window content, visible text, code comments, browser tabs, etc.
   - ONLY return task keys that are in the "User's Assigned Issues" list above
   - If you can't match to an assigned issue, return null for taskKey

3. **Confidence Score:**
   - High (0.9+): Clear Jira key visible or exact match to issue summary
   - Medium (0.6-0.8): Good contextual match (e.g., code matches issue description)
   - Low (0.3-0.5): Weak match or just general work activity
   - Very Low (0.0-0.2): No clear task association

IMPORTANT RULES:
- Track EVERYTHING - don't skip any activities
- Let AI decide dynamically what is office vs non-office work
- Work-related YouTube tutorials = 'office'
- Entertainment YouTube = 'non-office'
- Be smart about context - coding tutorial = office, cat videos = non-office
- ONLY return task keys from the assigned issues list
- If screenshot shows work but doesn't match any assigned issue, set taskKey to null

Return ONLY valid JSON in this exact format:
{
  "workType": "office" or "non-office",
  "taskKey": "PROJECT-123" or null,
  "projectKey": "PROJECT" or null,
  "confidenceScore": 0.0-1.0,
  "detectedJiraKeys": ["KEY1", "KEY2"],
  "reasoning": "Brief explanation of your analysis"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o', // gpt-4o has vision capabilities
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing work activity from screenshots. You classify work as office or non-office and identify Jira tasks dynamically without hardcoded rules.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
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
      max_tokens: 500
    });

    const content = response.choices[0].message.content.trim();

    // Parse JSON from the response
    let aiResult;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      aiResult = JSON.parse(jsonString);
    } catch (parseError) {
      logger.warn('Failed to parse AI response as JSON', { content });
      throw new Error('Invalid JSON response from AI');
    }

    // Validate work_type
    if (aiResult.workType !== 'office' && aiResult.workType !== 'non-office') {
      logger.warn('Invalid work_type from AI, defaulting to office', { workType: aiResult.workType });
      aiResult.workType = 'office';
    }

    // Validate task key is in user's assigned issues (if provided)
    let validatedTaskKey = aiResult.taskKey || null;
    let detectedJiraKeys = aiResult.detectedJiraKeys || [];

    if (validatedTaskKey && userAssignedIssues && userAssignedIssues.length > 0) {
      const assignedIssueKeys = userAssignedIssues.map(issue => issue.key);
      if (!assignedIssueKeys.includes(validatedTaskKey)) {
        logger.warn('AI returned task key not in assigned issues, setting to null', {
          aiTaskKey: validatedTaskKey,
          assignedKeys: assignedIssueKeys
        });
        validatedTaskKey = null;
      }

      // Filter detected keys to only assigned issues
      detectedJiraKeys = detectedJiraKeys.filter(key => assignedIssueKeys.includes(key));
    }

    // Return validated analysis
    return {
      workType: aiResult.workType,
      taskKey: validatedTaskKey,
      projectKey: aiResult.projectKey || (validatedTaskKey ? validatedTaskKey.split('-')[0] : null),
      confidenceScore: Math.min(Math.max(aiResult.confidenceScore || 0.5, 0), 1), // Clamp between 0 and 1
      detectedJiraKeys,
      reasoning: aiResult.reasoning || '',
      modelVersion: 'v3.0-vision'
    };
  } catch (error) {
    logger.error('GPT-4 Vision analysis error:', error);
    throw error;
  }
}

/**
 * Analyze screenshot using GPT-4 text model with OCR (fallback method)
 */
async function analyzeWithAI({ extractedText, windowTitle, applicationName, detectedJiraKeys, userAssignedIssues = [] }) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Build user's assigned issues list for the prompt
  let assignedIssuesText = 'None - track all work';
  if (userAssignedIssues && userAssignedIssues.length > 0) {
    assignedIssuesText = userAssignedIssues
      .slice(0, 20)
      .map(issue => `- ${issue.key}: ${issue.summary} (Status: ${issue.status})`)
      .join('\n');
  }

  const prompt = `You are analyzing a screenshot to determine what Jira task the user is working on and classify work type.

Context:
- Application: ${applicationName}
- Window Title: ${windowTitle}
- Extracted Text (from OCR): ${extractedText.substring(0, 1000)}${extractedText.length > 1000 ? '...' : ''}
- Detected Jira Keys: ${detectedJiraKeys.length > 0 ? detectedJiraKeys.join(', ') : 'None found'}

User's Assigned Issues (from Jira):
${assignedIssuesText}

Analyze this information and determine:

1. Work Type: 'office' (work-related) or 'non-office' (personal/entertainment)
2. Task Key: Which Jira issue from the assigned list (or null)
3. Confidence Score: 0.0 to 1.0

Rules:
- Track EVERYTHING - classify as office or non-office
- Work-related YouTube = office, entertainment = non-office
- ONLY return task keys from the assigned issues list
- Return ONLY valid JSON in this exact format:
{
  "workType": "office" or "non-office",
  "taskKey": "PROJECT-123" or null,
  "projectKey": "PROJECT" or null,
  "confidenceScore": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing work activity. You classify work dynamically without hardcoded rules.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const content = response.choices[0].message.content.trim();

    // Parse JSON
    let aiResult;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      aiResult = JSON.parse(jsonString);
    } catch (parseError) {
      logger.warn('Failed to parse AI response as JSON', { content });
      throw new Error('Invalid JSON response from AI');
    }

    // Validate work_type
    if (aiResult.workType !== 'office' && aiResult.workType !== 'non-office') {
      aiResult.workType = 'office';
    }

    // Validate task key
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

    return {
      workType: aiResult.workType,
      taskKey: validatedTaskKey,
      projectKey: aiResult.projectKey || (validatedTaskKey ? validatedTaskKey.split('-')[0] : null),
      confidenceScore: Math.min(Math.max(aiResult.confidenceScore || 0.5, 0), 1),
      detectedJiraKeys,
      reasoning: aiResult.reasoning || '',
      modelVersion: 'v2.1-ocr-ai'
    };
  } catch (error) {
    logger.error('OpenAI analysis error:', error);
    throw error;
  }
}

/**
 * Extract text from screenshot using OCR (fallback method)
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
 * Extract Jira issue keys from text (e.g., PROJ-123)
 */
function extractJiraKeys(text, windowTitle = '') {
  const jiraKeyPattern = /\b([A-Z]{2,10}-\d+)\b/g;
  const combinedText = `${text} ${windowTitle}`;

  const matches = combinedText.match(jiraKeyPattern);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Create worklog in Jira via Forge app
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
