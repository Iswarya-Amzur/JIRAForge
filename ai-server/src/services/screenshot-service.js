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
      const extractedText = await extractText(imageBuffer);

      // Use AI for enhanced analysis of OCR text
      try {
        visionAnalysis = await analyzeWithAI({
          extractedText,
          windowTitle,
          applicationName,
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
        // Last fallback: basic heuristics - default to office work with no specific task
        visionAnalysis = {
          taskKey: null,
          projectKey: null,
          workType: 'office', // Default to office work
          confidenceScore: 0.3,
          reasoning: 'Fallback to basic heuristics - AI analysis failed',
          extractedText
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
      workType, // 'office' or 'non-office'
      modelVersion: visionAnalysis?.modelVersion || 'v3.1-vision-thorough',
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
      .map(issue => {
        let issueText = `- ${issue.key}: ${issue.summary} (Status: ${issue.status})`;

        // Add description if available (provides important context)
        if (issue.description && issue.description.trim()) {
          // Truncate long descriptions to save tokens
          const desc = issue.description.length > 200
            ? issue.description.substring(0, 200) + '...'
            : issue.description;
          issueText += `\n  Description: ${desc}`;
        }

        // Add labels if available (helps with categorization)
        if (issue.labels && issue.labels.length > 0) {
          issueText += `\n  Labels: ${issue.labels.join(', ')}`;
        }

        return issueText;
      })
      .join('\n');
  }

  const prompt = `You are an expert screenshot analyzer. Your job is to THOROUGHLY examine this screenshot and determine what task the user is working on.

Context:
- Application: ${applicationName}
- Window Title: ${windowTitle}

User's Assigned Issues (from Jira):
${assignedIssuesText}

## STEP 1: DEEPLY ANALYZE THE SCREENSHOT

Carefully examine EVERYTHING visible in the screenshot:

**If it's a CODE EDITOR (VS Code, Cursor, IntelliJ, etc.):**
- READ the actual code visible on screen - function names, variable names, class names
- Look at file names in tabs, sidebar, or title bar
- Read code comments that might mention features or tasks
- Identify what the code is doing (e.g., "implementing login", "fixing bug in API", "adding validation")
- Check terminal/console output for clues
- Look at git branch names if visible

**If it's a BROWSER:**
- Read the page title, URL, and content
- Look at tab names
- Identify if it's documentation, Stack Overflow, API docs, etc.
- What topic is being researched?

**If it's a DESIGN TOOL (Figma, Photoshop, etc.):**
- What is being designed? (e.g., "login page", "dashboard", "mobile app")
- Look at layer names, artboard names

**If it's a TERMINAL/COMMAND LINE:**
- Read the commands being run
- Check git commits, branch names
- Look at build/test output

**If it's COMMUNICATION (Slack, Teams, Email):**
- What project/feature is being discussed?
- Are there any issue references?

## STEP 2: MATCH TO ASSIGNED ISSUES

Now compare what you found in Step 1 to the user's assigned issues:

- If an issue says "Implement user authentication" and you see code with login/auth functions → MATCH
- If an issue says "Fix dashboard loading bug" and you see dashboard-related code/debugging → MATCH
- If an issue says "Add export to PDF feature" and you see PDF generation code → MATCH
- If an issue says "Update API endpoints" and you see REST API code → MATCH

**Match based on MEANING, not just keywords.** For example:
- Issue: "Add dark mode support" + Screenshot shows: theme switching code, CSS variables for colors → MATCH
- Issue: "Improve performance" + Screenshot shows: profiling tools, optimization code → MATCH

## STEP 3: WORK TYPE CLASSIFICATION

- 'office': Coding, debugging, documentation, Jira, meetings, Slack/Teams, work research, technical tutorials
- 'non-office': Entertainment, social media, personal browsing, gaming, shopping

## CONFIDENCE SCORING

- 0.9-1.0: The screenshot content DIRECTLY relates to the issue (e.g., exact feature being implemented)
- 0.7-0.8: Strong contextual match (same area of codebase, related functionality)
- 0.5-0.6: Reasonable match (working in the right project/module)
- 0.3-0.4: Weak match (only general similarity)
- 0.0-0.2: Cannot determine or no match

## RULES

1. ALWAYS try to match to an issue by understanding the CONTENT, not just looking for Jira keys
2. READ the code/text in the screenshot thoroughly
3. ONLY return task keys from the assigned issues list above
4. If you truly cannot determine which task (content is too generic or unrelated), return null
5. When there's a reasonable match based on content analysis, USE IT - don't default to null

Return ONLY valid JSON:
{
  "workType": "office" or "non-office",
  "taskKey": "PROJECT-123" or null,
  "projectKey": "PROJECT" or null,
  "confidenceScore": 0.0-1.0,
  "contentAnalysis": "What I see: [describe the main content - code functions, file names, what's being worked on]",
  "reasoning": "Why I matched to this issue: [explain the connection between screenshot content and the issue]"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o', // gpt-4o has vision capabilities
      messages: [
        {
          role: 'system',
          content: 'You are an expert screenshot analyzer with exceptional attention to detail. Your specialty is reading and understanding code, text, and visual content in screenshots to determine what task a developer is working on. You thoroughly examine every element - code syntax, function names, file names, comments, terminal output, browser content - to match the work to Jira issues. You understand that Jira keys are rarely visible, so you focus on understanding the CONTENT and matching it semantically to issue descriptions.'
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
      max_tokens: 800 // Increased for more detailed content analysis
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
      contentAnalysis: aiResult.contentAnalysis || '', // What the AI saw in the screenshot
      reasoning: aiResult.reasoning || '',
      modelVersion: 'v3.1-vision-thorough'
    };
  } catch (error) {
    logger.error('GPT-4 Vision analysis error:', error);
    throw error;
  }
}

/**
 * Analyze screenshot using GPT-4 text model with OCR (fallback method)
 */
async function analyzeWithAI({ extractedText, windowTitle, applicationName, userAssignedIssues = [] }) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Build user's assigned issues list for the prompt
  let assignedIssuesText = 'None - track all work';
  if (userAssignedIssues && userAssignedIssues.length > 0) {
    assignedIssuesText = userAssignedIssues
      .slice(0, 20)
      .map(issue => {
        let issueText = `- ${issue.key}: ${issue.summary} (Status: ${issue.status})`;

        // Add description if available (provides important context)
        if (issue.description && issue.description.trim()) {
          // Truncate long descriptions to save tokens
          const desc = issue.description.length > 200
            ? issue.description.substring(0, 200) + '...'
            : issue.description;
          issueText += `\n  Description: ${desc}`;
        }

        // Add labels if available (helps with categorization)
        if (issue.labels && issue.labels.length > 0) {
          issueText += `\n  Labels: ${issue.labels.join(', ')}`;
        }

        return issueText;
      })
      .join('\n');
  }

  const prompt = `You are analyzing extracted text from a screenshot to determine what Jira task the user is working on.

Context:
- Application: ${applicationName}
- Window Title: ${windowTitle}
- Extracted Text (from OCR): ${extractedText.substring(0, 1000)}${extractedText.length > 1000 ? '...' : ''}

User's Assigned Issues (from Jira):
${assignedIssuesText}

Analyze the extracted text and determine which assigned issue the user is working on based on the content.

1. Work Type: 'office' (work-related) or 'non-office' (personal/entertainment)
2. Task Key: Match the content to one of the assigned issues (or null if no match)
3. Confidence Score: 0.0 to 1.0

Rules:
- Analyze the text content to understand what work is being done
- Match to an issue based on content similarity, not just keywords
- ONLY return task keys from the assigned issues list
- Return ONLY valid JSON:
{
  "workType": "office" or "non-office",
  "taskKey": "PROJECT-123" or null,
  "projectKey": "PROJECT" or null,
  "confidenceScore": 0.0-1.0,
  "reasoning": "Brief explanation of why this matches the issue"
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
