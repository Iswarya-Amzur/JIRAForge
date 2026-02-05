/**
 * Feedback Controller
 * Handles feedback form sessions, serving the form, submissions, and status checks
 *
 * Endpoints:
 * - POST /api/feedback/session - Create feedback session (desktop app sends Atlassian token)
 * - GET /api/feedback/form - Serve feedback form (session-authenticated)
 * - POST /api/feedback/submit - Submit feedback with images
 * - GET /api/feedback/status/:id - Check feedback/Jira creation status
 */

const axios = require('axios');
const path = require('path');
const logger = require('../utils/logger');
const sessionStore = require('../services/feedback-session-store');
const { createFeedback, getFeedbackById } = require('../services/db/feedback-db-service');
const { uploadFile } = require('../services/db/storage-service');
const { processAndCreateJiraTicket } = require('../services/feedback-service');

const ATLASSIAN_ME_URL = 'https://api.atlassian.com/me';

/**
 * Create a feedback session
 * Desktop app calls this with the user's Atlassian token to get a session ID,
 * then opens the browser to the feedback form with that session.
 *
 * POST /api/feedback/session
 * Body: { atlassian_token: string, cloud_id: string }
 */
exports.createSession = async (req, res) => {
  try {
    const { atlassian_token, cloud_id } = req.body;

    if (!atlassian_token) {
      return res.status(400).json({
        success: false,
        error: 'Atlassian token is required'
      });
    }

    if (!cloud_id) {
      return res.status(400).json({
        success: false,
        error: 'Cloud ID is required'
      });
    }

    // Verify the Atlassian token by fetching user info
    let atlassianUser;
    try {
      const userResponse = await axios.get(ATLASSIAN_ME_URL, {
        headers: {
          'Authorization': `Bearer ${atlassian_token}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      atlassianUser = userResponse.data;
    } catch (error) {
      logger.warn('[Feedback] Invalid Atlassian token:', error.response?.status);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Atlassian token'
      });
    }

    // Create session
    const sessionId = sessionStore.createSession({
      atlassianToken: atlassian_token,
      cloudId: cloud_id,
      userInfo: {
        account_id: atlassianUser.account_id,
        email: atlassianUser.email,
        name: atlassianUser.name || atlassianUser.display_name
      }
    });

    // Build feedback form URL (using /api prefix so nginx forwards to AI server)
    const protocol = req.protocol;
    const host = req.get('host');
    const feedbackUrl = `${protocol}://${host}/api/feedback/form?session=${sessionId}`;

    logger.info('[Feedback] Session created for user %s', atlassianUser.account_id);

    res.json({
      success: true,
      session_id: sessionId,
      feedback_url: feedbackUrl
    });

  } catch (error) {
    logger.error('[Feedback] Session creation error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to create feedback session: ${error.message}`
    });
  }
};

/**
 * Serve the feedback form page
 * Validates the session query parameter before serving the HTML.
 *
 * GET /api/feedback/form?session=<session_id>
 */
exports.getFeedbackPage = (req, res) => {
  const sessionId = req.query.session;

  if (!sessionId) {
    return res.status(400).send(getErrorPage('Missing session parameter. Please use the "Send Feedback" option from the desktop app.'));
  }

  const session = sessionStore.getSession(sessionId);
  if (!session) {
    return res.status(401).send(getErrorPage('Invalid or expired session. Please use the "Send Feedback" option from the desktop app to get a new session.'));
  }

  res.sendFile(path.join(__dirname, '..', 'feedback', 'feedback-form.html'));
};

/**
 * Submit feedback
 * Validates session, uploads images to Supabase, saves feedback to DB,
 * and triggers async AI processing + Jira ticket creation.
 *
 * POST /api/feedback/submit
 * Body: { session_id, category, title?, description, images?: [{ data: base64, name, type }], app_version? }
 */
exports.submitFeedback = async (req, res) => {
  try {
    const { session_id, category, title, description, images, app_version } = req.body;

    if (!session_id) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, error: 'Description is required' });
    }

    // Validate category
    const validCategories = ['bug', 'feature_request', 'improvement', 'question', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, error: 'Invalid category' });
    }

    // Consume session (one-time use)
    const session = sessionStore.consumeSession(session_id);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid, expired, or already-used session'
      });
    }

    // Upload images to Supabase storage
    const imagePaths = [];
    if (images && Array.isArray(images)) {
      const maxImages = 3;
      const maxSizeBytes = 5 * 1024 * 1024; // 5MB

      for (let i = 0; i < Math.min(images.length, maxImages); i++) {
        const img = images[i];
        if (!img.data || !img.type) continue;

        // Decode base64
        const buffer = Buffer.from(img.data, 'base64');

        // Validate size
        if (buffer.length > maxSizeBytes) {
          logger.warn('[Feedback] Image %d exceeds 5MB limit (%d bytes), skipping', i, buffer.length);
          continue;
        }

        // Validate MIME type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(img.type)) {
          logger.warn('[Feedback] Invalid image type %s, skipping', img.type);
          continue;
        }

        // Generate storage path
        const ext = img.type.split('/')[1] === 'jpeg' ? 'jpg' : img.type.split('/')[1];
        const storagePath = `${session.userInfo.account_id}/${Date.now()}_${i}.${ext}`;

        try {
          await uploadFile('feedback-images', storagePath, buffer, {
            contentType: img.type,
            upsert: false
          });
          imagePaths.push(storagePath);
        } catch (uploadError) {
          logger.warn('[Feedback] Failed to upload image %d: %s', i, uploadError.message);
        }
      }
    }

    // Save feedback to database
    const feedback = await createFeedback({
      atlassian_account_id: session.userInfo.account_id,
      user_email: session.userInfo.email,
      user_display_name: session.userInfo.name,
      jira_cloud_id: session.cloudId,
      category,
      title: title || null,
      description: description.trim(),
      image_paths: imagePaths,
      image_count: imagePaths.length,
      app_version: app_version || null
    });

    // Trigger async AI processing + Jira ticket creation
    // Tickets are created on the configured Jira instance (server-side credentials)
    processAndCreateJiraTicket(feedback.id)
      .catch(err => logger.error('[Feedback] Async processing error:', err));

    logger.info('[Feedback] Feedback %s submitted (category: %s, images: %d)',
      feedback.id, category, imagePaths.length);

    res.json({
      success: true,
      feedback_id: feedback.id,
      message: 'Feedback submitted successfully. A Jira ticket will be created shortly.'
    });

  } catch (error) {
    logger.error('[Feedback] Submit error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to submit feedback: ${error.message}`
    });
  }
};

/**
 * Get feedback status (poll for Jira ticket creation status)
 *
 * GET /api/feedback/status/:id
 */
exports.getFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Feedback ID is required' });
    }

    const feedback = await getFeedbackById(id);
    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }

    res.json({
      success: true,
      status: feedback.jira_creation_status,
      jira_issue_key: feedback.jira_issue_key || null,
      jira_issue_url: feedback.jira_issue_url || null,
      error: feedback.jira_creation_error || null
    });

  } catch (error) {
    logger.error('[Feedback] Status check error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to check feedback status: ${error.message}`
    });
  }
};

/**
 * Generate a simple error HTML page
 * @param {string} message - Error message to display
 * @returns {string} HTML error page
 */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getErrorPage(message) {
  const safeMessage = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback - Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .error-card { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
    .error-card h1 { color: #DE350B; margin-bottom: 16px; }
    .error-card p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="error-card">
    <h1>Session Error</h1>
    <p>${safeMessage}</p>
  </div>
</body>
</html>`;
}
