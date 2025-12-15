const OpenAI = require('openai');
const logger = require('../utils/logger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Applications that should ALWAYS be grouped separately (system/idle apps)
const SYSTEM_APPS = [
  'lockapp', 'lock', 'screenlock',
  'idle', 'afk',
  'screensaver',
  'logonui',
  'shutdown'
];

// Applications that represent actual work and should be grouped by content
const WORK_APPS = [
  'code', 'vscode', 'cursor', 'sublime', 'atom', 'notepad++', 'vim', 'neovim', // Editors
  'chrome', 'firefox', 'edge', 'brave', 'safari', 'opera', // Browsers
  'terminal', 'windowsterminal', 'cmd', 'powershell', 'iterm', 'warp', // Terminals
  'slack', 'teams', 'discord', 'zoom', 'meet', // Communication
  'outlook', 'gmail', 'thunderbird', // Email
  'figma', 'sketch', 'photoshop', 'illustrator', // Design
  'excel', 'word', 'powerpoint', 'sheets', 'docs' // Office
];

/**
 * Normalize application name for comparison
 */
function normalizeAppName(appName) {
  if (!appName) return 'unknown';
  return appName.toLowerCase().replace('.exe', '').replace(/\s+/g, '').trim();
}

/**
 * Check if an application is a system/idle app
 */
function isSystemApp(appName) {
  const normalized = normalizeAppName(appName);
  return SYSTEM_APPS.some(sysApp => normalized.includes(sysApp));
}

/**
 * Create clustering input text from session data
 */
function createClusteringInput(session) {
  const reasoning = session.reasoning || session.analysis_metadata?.reasoning || 'No description available';
  const app = session.application_name?.replace('.exe', '') || 'Unknown';
  const windowTitle = session.window_title || 'Unknown';
  const isSystem = isSystemApp(app);

  return `
Application: ${app}${isSystem ? ' [SYSTEM/IDLE - DO NOT MIX WITH WORK]' : ''}
Window Title: ${windowTitle}
Activity Description: ${reasoning}
Duration: ${Math.round((session.time_spent_seconds || 0) / 60)} minutes
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

    // If too many sessions, process in batches
    const MAX_SESSIONS_PER_BATCH = 50;
    if (sessions.length > MAX_SESSIONS_PER_BATCH) {
      logger.info(`Large session count (${sessions.length}), processing in batches of ${MAX_SESSIONS_PER_BATCH}`);
      return await clusterInBatches(sessions, userIssues, MAX_SESSIONS_PER_BATCH);
    }

    // Create input text for each session
    const sessionDescriptions = sessions.map((session, index) => {
      return `Session ${index + 1} (ID: ${session.id}, Time: ${session.time_spent_seconds}s):
${createClusteringInput(session)}`;
    }).join('\n\n');

    // Create user issues context
    const issuesContext = userIssues.length > 0
      ? `\n\nUser's assigned Jira issues (for matching suggestions):\n${userIssues.map(issue =>
          `- ${issue.issue_key}: ${issue.summary}`
        ).join('\n')}`
      : '';

    // Pre-categorize sessions by application type for better context
    const systemSessions = sessions.filter(s => isSystemApp(s.application_name));
    const workSessions = sessions.filter(s => !isSystemApp(s.application_name));

    // GPT-4 clustering prompt with smart rules
    const prompt = `You are an AI assistant helping to group similar work sessions together for time tracking.

GROUPING RULES:

1. **NEVER mix system/idle apps with work apps**
   - System/Idle apps: LockApp, ScreenSaver, LogonUI, etc. (marked with [SYSTEM/IDLE])
   - These represent breaks/idle time and must be in their own separate group
   - Example: "Idle Time" or "Screen Lock Sessions"

2. **Group by PROJECT/TASK CONTEXT, not just application**
   - If someone works on the SAME project using VS Code, Cursor, Claude Code, and Terminal → GROUP THEM TOGETHER
   - Look at window titles, file paths, and activity descriptions to identify the project
   - Example: All sessions showing "jira1" or "time-tracker" in the path = same project group

3. **Similar code editors working on same project = SAME GROUP**
   - VS Code + Cursor + Claude Code + Sublime working on "ProjectX" → one group: "ProjectX Development"
   - Terminal commands related to the same project → include in same group

4. **Different projects = DIFFERENT GROUPS**
   - VS Code on "ProjectA" vs VS Code on "ProjectB" = SEPARATE groups
   - Browser researching "React docs" vs Browser on "YouTube" = SEPARATE groups

5. **Examples of GOOD grouping:**
   - ✅ VS Code (jira1) + Cursor (jira1) + Terminal (npm start for jira1) → "Jira Time Tracker Development"
   - ✅ Chrome (Jira board) + Chrome (Jira issues) → "Jira Project Management"
   - ✅ LockApp + ScreenSaver → "Idle/Break Time"

6. **Examples of BAD grouping:**
   - ❌ LockApp + VS Code → NEVER mix idle with work
   - ❌ Chrome (YouTube) + VS Code (coding) → different activities
   - ❌ VS Code (ProjectA) + VS Code (ProjectB) → different projects

Pre-analysis:
- System/Idle sessions: ${systemSessions.length} (LockApp, ScreenSaver, etc.)
- Work sessions: ${workSessions.length} (Editors, Browsers, Terminals, etc.)
${issuesContext}

Sessions to group:
${sessionDescriptions}

Output Requirements:
1. Group label should describe the PROJECT or ACTIVITY (max 50 chars)
2. Description should explain what work was being done
3. Confidence: high (clearly same project/task), medium (likely related), low (loosely connected)
4. Suggest matching Jira issue if content matches

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
          content: `You are a work activity clustering assistant that groups time tracking sessions.

KEY RULES:
1. NEVER mix system/idle apps (LockApp, ScreenSaver) with work apps - they must be in separate groups
2. Group by PROJECT/TASK CONTEXT - if VS Code, Cursor, Terminal all show "jira1" project, group them TOGETHER
3. Different code editors working on the SAME project = SAME GROUP
4. Look at window titles, file paths, and descriptions to identify which project/task the work belongs to
5. Always respond with valid JSON only, no markdown formatting.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2, // Lower temperature for more consistent grouping
      max_tokens: 4000 // Increased for large session counts
    });

    const responseText = completion.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    let cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to extract JSON if response contains extra text
    // Look for the JSON object pattern
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*"groups"[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    // Try to parse JSON, with fallback for truncated responses
    let clusteringResult;
    try {
      clusteringResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.warn('Initial JSON parse failed, attempting to fix truncated response');

      // Try to fix common issues with truncated JSON
      // 1. If truncated mid-array, try to close it
      let fixedResponse = cleanedResponse;

      // Count open brackets
      const openBrackets = (fixedResponse.match(/\[/g) || []).length;
      const closeBrackets = (fixedResponse.match(/\]/g) || []).length;
      const openBraces = (fixedResponse.match(/\{/g) || []).length;
      const closeBraces = (fixedResponse.match(/\}/g) || []).length;

      // Add missing closing brackets/braces
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixedResponse += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixedResponse += '}';
      }

      // Remove trailing comma before closing bracket/brace
      fixedResponse = fixedResponse.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');

      try {
        clusteringResult = JSON.parse(fixedResponse);
        logger.info('Successfully parsed fixed JSON response');
      } catch (secondError) {
        // Log the problematic response for debugging
        logger.error('Failed to parse clustering response', {
          responseLength: cleanedResponse.length,
          responsePreview: cleanedResponse.substring(0, 500),
          responseEnd: cleanedResponse.substring(cleanedResponse.length - 200)
        });
        throw new Error(`Invalid JSON in clustering response: ${parseError.message}`);
      }
    }

    // Map session indices back to actual session data and calculate totals
    const enrichedGroups = clusteringResult.groups.map(group => {
      const groupSessions = group.session_indices.map(idx => sessions[idx - 1]).filter(Boolean);
      const totalSeconds = groupSessions.reduce((sum, s) => sum + (s.time_spent_seconds || 0), 0);
      const sessionIds = groupSessions.map(s => s.id);

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
 * Process large session counts in batches to avoid token limits
 * @param {Array} sessions - All sessions to cluster
 * @param {Array} userIssues - User's assigned Jira issues
 * @param {number} batchSize - Maximum sessions per batch
 * @returns {Promise<Object>} Combined clustered groups
 */
async function clusterInBatches(sessions, userIssues, batchSize) {
  const allGroups = [];
  const batches = [];

  // Split sessions into batches
  for (let i = 0; i < sessions.length; i += batchSize) {
    batches.push(sessions.slice(i, i + batchSize));
  }

  logger.info(`Processing ${batches.length} batches for ${sessions.length} sessions`);

  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    logger.info(`Processing batch ${i + 1}/${batches.length} with ${batch.length} sessions`);

    try {
      // Re-index sessions for this batch (1-based for the batch)
      const batchResult = await exports.clusterUnassignedWork(batch, userIssues);

      if (batchResult.groups) {
        // The groups from clusterUnassignedWork already have session_ids populated
        allGroups.push(...batchResult.groups);
      }
    } catch (batchError) {
      logger.error(`Error processing batch ${i + 1}:`, batchError);
      // Continue with other batches even if one fails
    }
  }

  // Merge similar groups across batches (by label)
  const mergedGroups = mergeGroups(allGroups);

  logger.info(`Merged into ${mergedGroups.length} groups from ${allGroups.length} batch groups`);

  return {
    groups: mergedGroups,
    total_sessions: sessions.length,
    total_groups: mergedGroups.length
  };
}

/**
 * Merge similar groups from different batches
 * Groups with similar labels/content should be combined
 */
function mergeGroups(groups) {
  const groupMap = new Map();

  for (const group of groups) {
    // Normalize label for comparison
    const normalizedLabel = group.label.toLowerCase().trim();

    if (groupMap.has(normalizedLabel)) {
      // Merge with existing group
      const existing = groupMap.get(normalizedLabel);
      existing.sessions = [...existing.sessions, ...group.sessions];
      existing.session_ids = [...existing.session_ids, ...group.session_ids];
      existing.total_seconds += group.total_seconds;
      existing.session_count += group.session_count;
      existing.total_time_formatted = formatDuration(existing.total_seconds);
    } else {
      // Create new entry
      groupMap.set(normalizedLabel, { ...group });
    }
  }

  return Array.from(groupMap.values());
}

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
