/**
 * Activity Service
 * Handles text-only AI analysis for the new event-based activity tracking pipeline.
 * - analyzeBatch(): Matches productive activity records to Jira issues (single LLM call)
 * - classifyUnknownApp(): Classifies unknown applications via LLM
 *
 * Uses the existing AI client with 3-tier fallback (Fireworks → LiteLLM).
 * No vision model needed — all analysis is text-only.
 */

const { chatCompletionWithFallback, isAIEnabled } = require('./ai/ai-client');
const { formatAssignedIssues } = require('./ai/prompts');
const activityDbService = require('./db/activity-db-service');
const logger = require('../utils/logger');

// ============================================================================
// PROMPTS
// ============================================================================

const BATCH_ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing work activity from text. You match activity records to Jira issues based on window titles, application names, and OCR-extracted text. You focus on understanding the CONTENT and matching it semantically to issue descriptions. You understand that Jira keys may appear in window titles or extracted text.`;

const APP_CLASSIFICATION_SYSTEM_PROMPT = `You are an expert at classifying desktop applications and websites into work categories. You determine whether an application is productive (work-related), non_productive (entertainment/personal), or private (sensitive personal data like banking, healthcare, passwords). You base your classification on the application name, window title, and any visible text content.`;

/**
 * Build the batch analysis prompt for multiple activity records.
 * Sends all records in a single prompt for efficient LLM usage.
 *
 * @param {Array} records - Activity records with OCR text
 * @param {string} assignedIssuesText - Formatted list of user's Jira issues
 * @returns {string} Complete user prompt
 */
function buildBatchAnalysisPrompt(records, assignedIssuesText) {
  const recordDescriptions = records.map((record, index) => {
    const ocrSnippet = record.ocr_text
      ? record.ocr_text.substring(0, 500)
      : '(no text extracted)';

    return `Record ${index}: [${record.application_name}] ${record.window_title}
  Time: ${record.total_time_seconds}s | ${record.start_time} → ${record.end_time}
  OCR Text: ${ocrSnippet}`;
  }).join('\n\n');

  return `Analyze these activity records and match each to the most relevant Jira issue.
Match based on MEANING, not just keywords. If a window title contains a Jira key, use it. If OCR text references specific features or code related to an issue, match it.

User's Assigned Issues (from Jira):
${assignedIssuesText}

Activity Records:
${recordDescriptions}

For EACH record, determine:
1. Which Jira issue is the user most likely working on?
2. Is this office work or non-office?
3. How confident are you in the match?

Return ONLY valid JSON (no markdown code blocks, no extra text). Your response must be exactly one JSON array:
[
  {
    "recordIndex": 0,
    "taskKey": "PROJECT-123" or null,
    "projectKey": "PROJECT" or null,
    "confidenceScore": 0.0-1.0,
    "workType": "office" or "non-office",
    "reasoning": "Brief explanation"
  }
]
Include one entry per record, in order.`;
}

/**
 * Build the app classification prompt for an unknown application.
 *
 * @param {string} appName - Application/process name
 * @param {string} windowTitle - Window title
 * @param {string} ocrText - OCR-extracted text from the app
 * @returns {string} Complete user prompt
 */
function buildClassificationPrompt(appName, windowTitle, ocrText) {
  const textSnippet = ocrText
    ? ocrText.substring(0, 800)
    : '(no text available)';

  return `Classify this application into one of three categories:

- **productive**: Work-related apps (IDEs, office suites, design tools, project management, communication tools, browsers on work sites, development tools, cloud consoles, documentation)
- **non_productive**: Entertainment and personal distractions (streaming, social media, gaming, shopping, music, news/memes)
- **private**: Sensitive personal apps where no data should be captured (banking, healthcare, personal finance, password managers, personal messaging, tax software, account management)

Application Details:
- Process Name: ${appName}
- Window Title: ${windowTitle}
- Screen Text: ${textSnippet}

Rules:
- If the app handles sensitive personal/financial/health data → classify as "private"
- If the app is clearly entertainment/personal → classify as "non_productive"
- If the app could be work-related or is ambiguous → classify as "productive"
- Consider the window title and text content for context (e.g., a browser on a banking site is "private")

Return ONLY valid JSON (no markdown, no extra text):
{
  "classification": "productive" or "non_productive" or "private",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this classification was chosen",
  "suggestedDisplayName": "Human-readable app name"
}`;
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Analyze a batch of productive activity records using text-only LLM.
 * Sends a single API call with all records for efficiency.
 *
 * @param {Array} records - Activity records with OCR text
 * @param {Array} userAssignedIssues - User's assigned Jira issues
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeBatch(records, userAssignedIssues, userId, organizationId) {
  if (!isAIEnabled()) {
    throw new Error('AI client not initialized - check API keys');
  }

  // Format assigned issues for the prompt
  const assignedIssuesText = formatAssignedIssues(userAssignedIssues);

  // Build the batch prompt
  const userPrompt = buildBatchAnalysisPrompt(records, assignedIssuesText);

  const messages = [
    { role: 'system', content: BATCH_ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  try {
    const { response, provider, model } = await chatCompletionWithFallback({
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      isVision: false,
      reasoningEffort: 'none',
      userId,
      organizationId
    });

    const content = response.choices[0].message.content.trim();
    logger.info(`[ActivityService] Batch analysis done | ${provider} (${model}) | ${records.length} records`);

    // Parse JSON array from response
    let analyses;
    try {
      // Try direct parse first
      analyses = JSON.parse(content);
    } catch (e) {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        analyses = JSON.parse(jsonMatch[0]);
      } else {
        logger.error('[ActivityService] Failed to parse batch analysis response:', content.substring(0, 200));
        throw new Error('Failed to parse AI response as JSON array');
      }
    }

    if (!Array.isArray(analyses)) {
      throw new Error('AI response is not a JSON array');
    }

    // Validate task keys against assigned issues
    const validKeys = new Set(userAssignedIssues.map(i => i.key));
    for (const analysis of analyses) {
      if (analysis.taskKey && !validKeys.has(analysis.taskKey)) {
        // AI hallucinated a key — clear it
        logger.warn(`[ActivityService] AI returned invalid task key: ${analysis.taskKey}`);
        analysis.taskKey = null;
        analysis.projectKey = null;
        analysis.confidenceScore = Math.min(analysis.confidenceScore || 0, 0.3);
      }
    }

    // Update records in database
    for (const analysis of analyses) {
      const recordIndex = analysis.recordIndex;
      if (recordIndex >= 0 && recordIndex < records.length && records[recordIndex].id) {
        try {
          await activityDbService.updateActivityRecordAnalysis(records[recordIndex].id, {
            taskKey: analysis.taskKey,
            projectKey: analysis.projectKey,
            metadata: {
              workType: analysis.workType || 'office',
              confidenceScore: analysis.confidenceScore,
              reasoning: analysis.reasoning,
              aiProvider: provider,
              aiModel: model
            }
          });
        } catch (updateErr) {
          logger.error(`[ActivityService] Failed to update record ${records[recordIndex].id}:`, updateErr);
        }
      }
    }

    return {
      analyses,
      recordsProcessed: records.length,
      provider,
      model
    };

  } catch (error) {
    logger.error('[ActivityService] Batch analysis failed:', error.message);
    throw error;
  }
}

/**
 * Classify an unknown application using LLM.
 *
 * @param {string} appName - Application/process name
 * @param {string} windowTitle - Window title
 * @param {string} ocrText - OCR-extracted text
 * @returns {Promise<Object>} Classification result
 */
async function classifyUnknownApp(appName, windowTitle, ocrText) {
  if (!isAIEnabled()) {
    throw new Error('AI client not initialized - check API keys');
  }

  const userPrompt = buildClassificationPrompt(appName, windowTitle, ocrText);

  const messages = [
    { role: 'system', content: APP_CLASSIFICATION_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  try {
    const { response, provider, model } = await chatCompletionWithFallback({
      messages,
      temperature: 0.2,
      max_tokens: 300,
      isVision: false,
      reasoningEffort: 'none'
    });

    const content = response.choices[0].message.content.trim();
    logger.info(`[ActivityService] App classification done | ${provider} (${model}) | ${appName}`);

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        logger.error('[ActivityService] Failed to parse classification response:', content.substring(0, 200));
        throw new Error('Failed to parse AI classification response');
      }
    }

    // Validate classification value
    const validClassifications = ['productive', 'non_productive', 'private'];
    if (!validClassifications.includes(result.classification)) {
      logger.warn(`[ActivityService] Invalid classification: ${result.classification}, defaulting to productive`);
      result.classification = 'productive';
    }

    return {
      classification: result.classification,
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning || '',
      suggestedDisplayName: result.suggestedDisplayName || appName,
      aiProvider: provider,
      aiModel: model
    };

  } catch (error) {
    logger.error('[ActivityService] App classification failed:', error.message);
    // Default to productive on failure (safest — will trigger OCR + AI analysis)
    return {
      classification: 'productive',
      confidence: 0.0,
      reasoning: 'Classification failed, defaulting to productive',
      suggestedDisplayName: appName,
      error: error.message
    };
  }
}

module.exports = {
  analyzeBatch,
  classifyUnknownApp
};
