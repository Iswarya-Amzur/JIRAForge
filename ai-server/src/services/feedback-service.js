/**
 * Feedback Service
 * Orchestrates AI analysis of user feedback and Jira ticket creation
 */

const axios = require('axios');
const logger = require('../utils/logger');
const { chatCompletionWithFallback } = require('./ai/ai-client');
const { FEEDBACK_ANALYSIS_SYSTEM_PROMPT, buildFeedbackAnalysisPrompt } = require('./ai/feedback-prompts');
const { getFeedbackById, updateFeedbackStatus, updateFeedbackAIResults } = require('./db/feedback-db-service');

/**
 * Process feedback: AI analysis -> Jira ticket creation -> DB update
 * Runs asynchronously after feedback submission.
 * All tickets are created on a single configured Jira instance using
 * server-side API token credentials (JIRA_FEEDBACK_* env vars).
 * @param {string} feedbackId - Feedback record ID
 */
async function processAndCreateJiraTicket(feedbackId) {
  try {
    // Mark as processing
    await updateFeedbackStatus(feedbackId, 'processing');

    // Fetch feedback from DB
    const feedback = await getFeedbackById(feedbackId);
    if (!feedback) {
      logger.error('[Feedback] Feedback %s not found', feedbackId);
      return;
    }

    // Step 1: AI analysis
    let aiResults;
    try {
      aiResults = await analyzeFeedbackWithAI(feedback);
      await updateFeedbackAIResults(feedbackId, {
        ai_summary: aiResults.summary,
        ai_priority: aiResults.priority,
        ai_labels: aiResults.labels,
        ai_issue_type: aiResults.issueType,
        title: feedback.title ? undefined : aiResults.title
      });
    } catch (aiError) {
      logger.warn('[Feedback] AI analysis failed for %s, using defaults: %s', feedbackId, aiError.message);
      // Use sensible defaults if AI fails
      aiResults = {
        title: feedback.title || `[${feedback.category}] User Feedback`,
        summary: feedback.description,
        issueType: feedback.category === 'bug' ? 'Bug' : 'Task',
        priority: 'Medium',
        labels: [feedback.category.replace('_', '-')]
      };
    }

    // Step 2: Create Jira issue using server-configured credentials
    // Uses direct site URL (not api.atlassian.com gateway) for Basic auth compatibility
    const projectKey = process.env.JIRA_FEEDBACK_PROJECT;
    const jiraSiteUrl = process.env.JIRA_FEEDBACK_SITE_URL; // e.g., https://timetracker.atlassian.net
    const jiraEmail = process.env.JIRA_FEEDBACK_EMAIL;
    const jiraApiToken = process.env.JIRA_FEEDBACK_API_TOKEN;

    if (!projectKey || !jiraSiteUrl || !jiraEmail || !jiraApiToken) {
      const missing = [];
      if (!projectKey) missing.push('JIRA_FEEDBACK_PROJECT');
      if (!jiraSiteUrl) missing.push('JIRA_FEEDBACK_SITE_URL');
      if (!jiraEmail) missing.push('JIRA_FEEDBACK_EMAIL');
      if (!jiraApiToken) missing.push('JIRA_FEEDBACK_API_TOKEN');
      logger.error('[Feedback] Missing env vars: %s', missing.join(', '));
      await updateFeedbackStatus(feedbackId, 'failed', {
        error: `Server configuration incomplete: missing ${missing.join(', ')}`
      });
      return;
    }

    try {
      const jiraResult = await createJiraIssue(jiraEmail, jiraApiToken, jiraSiteUrl, {
        projectKey,
        title: aiResults.title || feedback.title || `[${feedback.category}] User Feedback`,
        description: feedback.description,
        aiSummary: aiResults.summary,
        issueType: aiResults.issueType,
        priority: aiResults.priority,
        labels: aiResults.labels,
        category: feedback.category,
        reporterName: feedback.user_display_name,
        reporterEmail: feedback.user_email
      });

      // Update DB with Jira info
      await updateFeedbackStatus(feedbackId, 'created', {
        jira_issue_key: jiraResult.key,
        jira_issue_url: jiraResult.url
      });

      logger.info('[Feedback] Jira ticket %s created for feedback %s', jiraResult.key, feedbackId);
    } catch (jiraError) {
      logger.error('[Feedback] Jira creation failed for %s: %s', feedbackId, jiraError.message);
      await updateFeedbackStatus(feedbackId, 'failed', {
        error: jiraError.message
      });
    }
  } catch (error) {
    logger.error('[Feedback] Error processing feedback %s:', feedbackId, error);
    try {
      await updateFeedbackStatus(feedbackId, 'failed', { error: error.message });
    } catch (dbError) {
      logger.error('[Feedback] Failed to update error status:', dbError);
    }
  }
}

/**
 * Analyze feedback with AI to generate structured Jira content
 * @param {Object} feedback - Feedback record from DB
 * @returns {Promise<Object>} AI analysis results
 */
async function analyzeFeedbackWithAI(feedback) {
  const prompt = buildFeedbackAnalysisPrompt({
    category: feedback.category,
    title: feedback.title,
    description: feedback.description
  });

  const { response } = await chatCompletionWithFallback({
    messages: [
      { role: 'system', content: FEEDBACK_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 1000,
    isVision: false
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty AI response');
  }

  // Parse JSON from response (handle possible markdown wrapping)
  let parsed;
  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    logger.warn('[Feedback] Failed to parse AI response: %s', content.substring(0, 200));
    throw new Error('Failed to parse AI response as JSON');
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    issueType: parsed.issueType || 'Task',
    priority: parsed.priority || 'Medium',
    labels: Array.isArray(parsed.labels) ? parsed.labels : []
  };
}

/**
 * Create a Jira issue via Atlassian REST API using basic auth (API token).
 * All tickets go to a single configured Jira instance.
 * Uses direct site URL (e.g., https://yoursite.atlassian.net) for Basic auth.
 * @param {string} email - Atlassian account email for basic auth
 * @param {string} apiToken - Atlassian API token for basic auth
 * @param {string} siteUrl - Jira site URL (e.g., https://timetracker.atlassian.net)
 * @param {Object} issueData - Issue data
 * @returns {Promise<Object>} Created issue { key, url }
 */
async function createJiraIssue(email, apiToken, siteUrl, issueData) {
  const {
    projectKey,
    title,
    description,
    aiSummary,
    issueType,
    priority,
    labels,
    category,
    reporterName,
    reporterEmail
  } = issueData;

  // Build ADF (Atlassian Document Format) description
  const adfContent = [];

  // AI Summary section
  if (aiSummary) {
    adfContent.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Summary' }]
    });
    adfContent.push({
      type: 'paragraph',
      content: [{ type: 'text', text: aiSummary }]
    });
  }

  // Original description
  adfContent.push({
    type: 'heading',
    attrs: { level: 3 },
    content: [{ type: 'text', text: 'User Description' }]
  });
  adfContent.push({
    type: 'paragraph',
    content: [{ type: 'text', text: description }]
  });

  // Metadata section
  adfContent.push({
    type: 'heading',
    attrs: { level: 3 },
    content: [{ type: 'text', text: 'Details' }]
  });
  adfContent.push({
    type: 'bulletList',
    content: [
      {
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Category: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: category }
          ]
        }]
      },
      {
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Submitted by: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: `${reporterName || 'Unknown'} (${reporterEmail || 'N/A'})` }
          ]
        }]
      },
      {
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Source: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: 'Desktop App Feedback Form' }
          ]
        }]
      }
    ]
  });

  const requestBody = {
    fields: {
      project: { key: projectKey },
      summary: title,
      description: {
        type: 'doc',
        version: 1,
        content: adfContent
      },
      issuetype: { name: issueType || 'Task' }
    }
  };

  // Add priority if supported
  if (priority) {
    requestBody.fields.priority = { name: priority };
  }

  // Add labels if provided
  if (labels && labels.length > 0) {
    requestBody.fields.labels = labels;
  }

  // Basic auth: base64(email:apiToken)
  const basicAuth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const authHeader = `Basic ${basicAuth}`;

  // Use direct site URL for Basic auth (not api.atlassian.com gateway)
  // Remove trailing slash if present
  const baseUrl = siteUrl.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/rest/api/3/issue`;

  try {
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const issueKey = response.data.key;

    // Build the browse URL directly from siteUrl
    const browseUrl = `${baseUrl}/browse/${issueKey}`;

    return {
      key: issueKey,
      url: browseUrl,
      id: response.data.id
    };
  } catch (error) {
    const errorMsg = error.response?.data?.errors
      ? JSON.stringify(error.response.data.errors)
      : error.response?.data?.errorMessages?.join(', ') || error.message;

    logger.error('[Feedback] Jira API error: %s', errorMsg);
    throw new Error(`Jira API error: ${errorMsg}`);
  }
}

module.exports = {
  processAndCreateJiraTicket,
  analyzeFeedbackWithAI,
  createJiraIssue
};
