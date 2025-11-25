const openai = require('../config/openai');
const logger = require('../utils/logger');

/**
 * Create clustering input text from session data
 */
function createClusteringInput(session) {
  const reasoning = session.analysis_metadata?.reasoning || 'No description available';
  const app = session.application_name?.replace('.exe', '') || 'Unknown';
  const windowTitle = session.window_title || 'Unknown';

  return `
Activity: ${reasoning}
Application: ${app}
Context: ${windowTitle}
Duration: ${Math.round(session.time_spent_seconds / 60)} minutes
  `.trim();
}

/**
 * Cluster unassigned work sessions using GPT-4
 * @param {Array} sessions - Array of unassigned work sessions
 * @param {Array} userIssues - User's assigned Jira issues for suggestion
 * @returns {Promise<Object>} Clustered groups
 */
exports.clusterUnassignedWork = async (sessions, userIssues = []) => {
  try {
    if (!sessions || sessions.length === 0) {
      return { groups: [] };
    }

    logger.info(`Clustering ${sessions.length} unassigned work sessions`);

    // Create input text for each session
    const sessionDescriptions = sessions.map((session, index) => {
      return `Session ${index + 1} (ID: ${session.screenshot_id}, Time: ${session.time_spent_seconds}s):
${createClusteringInput(session)}`;
    }).join('\n\n');

    // Create user issues context
    const issuesContext = userIssues.length > 0
      ? `\n\nUser's assigned Jira issues (for matching suggestions):\n${userIssues.map(issue =>
          `- ${issue.issue_key}: ${issue.summary}`
        ).join('\n')}`
      : '';

    // GPT-4 clustering prompt
    const prompt = `You are an AI assistant helping to group similar work sessions together for time tracking.

Below are ${sessions.length} unassigned work sessions that need to be grouped by similarity (similar tasks/topics/activities).
${issuesContext}

Sessions to group:
${sessionDescriptions}

Instructions:
1. Group sessions that represent similar work activities together
2. Each group should have a clear, concise label (max 50 chars)
3. Provide a brief description of what the group represents
4. If a group clearly matches one of the user's assigned issues, suggest it
5. Indicate confidence level: high (very similar), medium (somewhat similar), low (loosely related)
6. Recommend whether to "assign_to_existing" issue or "create_new_issue"

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "groups": [
    {
      "label": "Group Name",
      "description": "Brief description of the work",
      "session_indices": [1, 3, 5],
      "confidence": "high|medium|low",
      "recommendation": {
        "action": "assign_to_existing|create_new_issue",
        "suggested_issue_key": "SCRUM-X or null",
        "reason": "Why this recommendation"
      }
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a work activity clustering assistant. Always respond with valid JSON only, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const responseText = completion.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const clusteringResult = JSON.parse(cleanedResponse);

    // Map session indices back to actual session data and calculate totals
    const enrichedGroups = clusteringResult.groups.map(group => {
      const groupSessions = group.session_indices.map(idx => sessions[idx - 1]).filter(Boolean);
      const totalSeconds = groupSessions.reduce((sum, s) => sum + (s.time_spent_seconds || 0), 0);
      const sessionIds = groupSessions.map(s => s.screenshot_id);

      return {
        ...group,
        sessions: groupSessions,
        session_ids: sessionIds,
        total_seconds: totalSeconds,
        total_time_formatted: formatDuration(totalSeconds),
        session_count: groupSessions.length
      };
    });

    logger.info(`Created ${enrichedGroups.length} groups from ${sessions.length} sessions`);

    return {
      groups: enrichedGroups,
      total_sessions: sessions.length,
      total_groups: enrichedGroups.length
    };

  } catch (error) {
    logger.error('Error clustering unassigned work:', error);
    throw new Error(`Failed to cluster unassigned work: ${error.message}`);
  }
};

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Get unassigned work summary for a user
 */
exports.getUnassignedWorkSummary = async (sessions) => {
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.time_spent_seconds || 0), 0);
  const applications = [...new Set(sessions.map(s => s.application_name))];

  return {
    total_sessions: sessions.length,
    total_seconds: totalSeconds,
    total_time_formatted: formatDuration(totalSeconds),
    applications: applications,
    date_range: {
      earliest: sessions.length > 0 ? new Date(Math.min(...sessions.map(s => new Date(s.timestamp)))).toISOString() : null,
      latest: sessions.length > 0 ? new Date(Math.max(...sessions.map(s => new Date(s.timestamp)))).toISOString() : null
    }
  };
};
