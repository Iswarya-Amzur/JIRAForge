/**
 * A/B Prompt Comparison Test Script - Multi-Scenario
 *
 * Usage:
 *   node tests/test-prompts.js                          - Run ALL clustering scenarios
 *   node tests/test-prompts.js <screenshot-path>        - Also run vision comparison
 *   node tests/test-prompts.js --scenario 2             - Run specific scenario only
 *
 * Scenarios:
 *   1. Single project, multiple tools (dev coding across editors/terminal/browser)
 *   2. Multi-project switching (developer juggling 2 different projects)
 *   3. Communication-heavy day (Slack, Teams, Zoom, Email mixed with some coding)
 *   4. Research-heavy day (browser docs, tutorials, Stack Overflow + implementation)
 *   5. Mixed work and personal (YouTube, social media mixed with real work)
 *   6. Heavy idle with sparse work (lots of LockApp/ScreenSaver with brief work)
 *
 * This script does NOT modify any production files.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { chatCompletionWithFallback, initializeClient } = require('../src/services/ai/ai-client');

// ============================================================
// OLD PROMPTS (copied verbatim from current production code)
// ============================================================

const OLD_VISION_SYSTEM_PROMPT = `You are an expert screenshot analyzer with exceptional attention to detail. Your specialty is reading and understanding code, text, and visual content in screenshots to determine what task a developer is working on. You thoroughly examine every element - code syntax, function names, file names, comments, terminal output, browser content - to match the work to Jira issues. You understand that Jira keys are rarely visible, so you focus on understanding the CONTENT and matching it semantically to issue descriptions.`;

function buildOldVisionUserPrompt(applicationName, windowTitle, assignedIssuesText) {
  return `You are an expert screenshot analyzer. Your job is to THOROUGHLY examine this screenshot and determine what task the user is working on.

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
}

const OLD_CLUSTERING_SYSTEM_PROMPT = `You are a work activity clustering assistant that groups time tracking sessions for accurate time reporting.

KEY RULES:
1. NEVER mix system/idle apps (LockApp, ScreenSaver) with work apps - they must be in separate groups
2. Group by PROJECT/TASK CONTEXT - if VS Code, Cursor, Terminal all show "jira1" project, group them TOGETHER
3. Different code editors working on the SAME project = SAME GROUP
4. Look at window titles, file paths, and descriptions to identify which project/task the work belongs to
5. Always respond with valid JSON only, no markdown formatting.

CRITICAL - DESCRIPTIONS MUST BE SPECIFIC:
- Extract specific file names, component names, or URLs from the session data
- Describe the TYPE of work: coding, debugging, code review, research, documentation, etc.
- Mention what was accomplished or attempted
- NEVER use vague descriptions like "Development work" or "Coding activities"
- Good example: "Implemented user authentication in authController.js. Added login validation in validators/auth.js. Created LoginForm React component with error handling."
- Bad example: "Worked on the project"`;

function buildOldClusteringUserPrompt(sessionDescriptions, issuesContext, systemCount, workCount) {
  return `You are an AI assistant helping to group similar work sessions together for time tracking.

GROUPING RULES:

1. **NEVER mix system/idle apps with work apps**
   - System/Idle apps: LockApp, ScreenSaver, LogonUI, etc. (marked with [SYSTEM/IDLE])
   - These represent breaks/idle time and must be in their own separate group

2. **Group by PROJECT/TASK CONTEXT, not just application**
   - If someone works on the SAME project using VS Code, Cursor, Claude Code, and Terminal → GROUP THEM TOGETHER
   - Look at window titles, file paths, and activity descriptions to identify the project

3. **Similar code editors working on same project = SAME GROUP**
   - VS Code + Cursor + Claude Code + Sublime working on the same project → one group
   - Terminal commands related to the same project → include in same group

4. **Different projects = DIFFERENT GROUPS**
   - VS Code on "ProjectA" vs VS Code on "ProjectB" = SEPARATE groups

5. **AVOID SINGLE-ACTIVITY GROUPS** (CRITICAL!)
   - NEVER create a group with only 1 session unless it's truly unique
   - Prefer FEWER, LARGER groups over MANY small groups

6. **BE AGGRESSIVE WITH MERGING**
   - If two activities are even loosely related (same project, same type of work), group them
   - Email about Project X + Coding on Project X = SAME GROUP
   - Research for a feature + Implementing that feature = SAME GROUP

7. **Examples of GOOD grouping:**
   - VS Code (project-x) + Cursor (project-x) + Terminal (npm start) + Chrome (localhost) → "Project X - Development"
   - LockApp + ScreenSaver → "Idle/Break Time"

8. **Examples of BAD grouping:**
   - LockApp + VS Code → NEVER mix idle with work
   - Creating 10 groups with 1-2 sessions each → Too fragmented

Pre-analysis:
- System/Idle sessions: ${systemCount}
- Work sessions: ${workCount}
${issuesContext ? `\n\nUser's assigned Jira issues (for matching suggestions):\n${issuesContext}` : ''}

Sessions to group:
${sessionDescriptions}

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "groups": [
    {
      "label": "Specific Project - Task Name",
      "description": "Detailed description of what was done.",
      "session_indices": [1, 3, 5],
      "confidence": "high|medium|low",
      "recommendation": {
        "action": "assign_to_existing|create_new_issue",
        "suggested_issue_key": "SCRUM-X or null",
        "reason": "Specific reason why this issue matches"
      }
    }
  ]
}`;
}

// ============================================================
// NEW PROMPTS (proposed Gemini 2.5 Flash optimized)
// ============================================================

const NEW_VISION_SYSTEM_PROMPT = `You are an expert Technical Workflow Analyst specializing in multimodal screen understanding.
Your goal is to accurately link visual screen content to Jira work items.

<role_definition>
  You are a "Context Detective". You don't just read text; you interpret the *intent* of the active window.
  You understand that a developer looking at "Stack Overflow: How to center a div" is working on "Frontend UI", not "Researching general knowledge".
</role_definition>

<core_protocol>
  1. **Identify the Active Anchor:** Ignore background windows. Focus ONLY on the active, foreground application.
  2. **Chain of Evidence:** You must establish a logical link between the *visible code/content* and the *Jira intent*.
  3. **Strict Output:** You must output a JSON object.
</core_protocol>`;

function buildNewVisionUserPrompt(applicationName, windowTitle, assignedIssuesText) {
  return `You are analyzing a user's screen to automate time tracking.

<context>
  <active_application>${applicationName}</active_application>
  <window_title>${windowTitle}</window_title>
</context>

<jira_backlog>
${assignedIssuesText}
</jira_backlog>

<analysis_instructions>
  <step_1_visual_scan>
    Identify the FOREGROUND task.
    - If Code: What specific file, function, or variable is focused?
    - If Browser: What is the specific page topic?
    - If Design: What component is being edited?
  </step_1_visual_scan>

  <step_2_semantic_match>
    Compare the visual evidence to the <jira_backlog>.
    - **Direct Match:** Filename/function matches issue keywords.
    - **Context Match:** "Debugging tools" open + Issue "Fix crash" = MATCH.
    - **No Match:** If activity is unrelated to ANY issue, or is non-work.
  </step_2_semantic_match>

  <step_3_classification>
    Classify as 'office' (work) or 'non-office' (personal/entertainment).
  </step_3_classification>
</analysis_instructions>

Return JSON structure:
{
  "thought_process": "Brief reasoning chain linking evidence to issue",
  "workType": "office" | "non-office",
  "taskKey": "JIRA-KEY" | null,
  "projectKey": "PROJECT_KEY" | null,
  "confidenceScore": 0.0 to 1.0,
  "contentAnalysis": "Concise description of what is on screen"
}`;
}

const NEW_CLUSTERING_SYSTEM_PROMPT = `You are a Semantic Clustering Engine. Your purpose is to de-fragment time tracking data.

<clustering_philosophy>
  A "Work Session" is defined by **Intent**, not just Application.
  - If a user switches from "VS Code" to "Chrome (StackOverflow)" to "Terminal", but the *topic* is the same, that is ONE group.
  - You must aggressively MERGE related activities.
  - You must strictly SEPARATE system/idle noise.
</clustering_philosophy>

<naming_rules>
  - **Good Label:** "Refactoring Checkout API" (Specific)
  - **Bad Label:** "Development" (Too vague)
  - **Bad Label:** "Chrome & VS Code" (Describes tools, not work)
</naming_rules>

Output strictly Valid JSON.`;

function buildNewClusteringUserPrompt(sessionDescriptions, issuesContext, systemCount, workCount) {
  return `Analyze these raw activity logs and group them into logical work sessions.

<input_data>
  <stats>
    Idle/System Sessions: ${systemCount}
    Work Sessions: ${workCount}
  </stats>

  <raw_sessions>
  ${sessionDescriptions}
  </raw_sessions>

  <jira_context>
  ${issuesContext || 'No assigned Jira issues available.'}
  </jira_context>
</input_data>

<grouping_instructions>
  1. **Isolate Noise:** IMMEDIATELY group all 'LockApp', 'ScreenSaver', 'LogonUI' into a group called "Idle/Breaks".
  2. **Pattern Recognition:** Look for common strings in Window Titles across different apps (e.g., if 'ProjectAlpha' appears in VS Code AND Terminal, group them).
  3. **Semantic Merging:**
     - "Debugging" + "Reading Logs" = Same Group.
     - "Editing CSS" + "Viewing Localhost" = Same Group.
  4. **Orphans:** Avoid groups with only 1 item unless it is completely distinct (e.g., a 30-minute Zoom call).
</grouping_instructions>

<output_schema>
Return a JSON object with this exact structure:
{
  "groups": [
    {
      "label": "High-level summary of the task (max 50 chars)",
      "description": "Detailed narrative of the work done",
      "session_indices": [1, 2, 5],
      "confidence": "high|medium|low",
      "recommendation": {
        "action": "assign_to_existing" | "create_new_issue",
        "suggested_issue_key": "JIRA-KEY" | null,
        "reason": "Why this matches"
      }
    }
  ]
}
</output_schema>`;
}

// ============================================================
// TEST SCENARIOS
// ============================================================

const SCENARIOS = [
  // ---------------------------------------------------------
  // SCENARIO 1: Single project, multiple tools
  // Tests: Can it merge VS Code + Cursor + Terminal + Browser
  //        all working on the same project into ONE group?
  // ---------------------------------------------------------
  {
    name: 'Single Project, Multiple Tools',
    description: 'Developer uses VS Code, Cursor, Terminal, and Chrome all on the same JIRAForge project. Should produce 2 groups: 1 work group + 1 idle group.',
    issues: [
      { key: 'SCRUM-46', summary: 'Refactor screenshot analysis prompts', status: 'In Progress', description: 'Improve AI prompts for better task matching accuracy using Gemini 2.5', labels: ['ai', 'prompts'] },
      { key: 'SCRUM-43', summary: 'Fix dashboard loading performance', status: 'To Do', description: 'Dashboard takes 5s to load, optimize queries', labels: ['performance'] },
    ],
    sessions: [
      { id: 's1-1', application_name: 'Code.exe', window_title: 'vision-analyzer.js - JIRAForge', time_spent_seconds: 600, reasoning: 'Editing vision analyzer code for screenshot processing' },
      { id: 's1-2', application_name: 'Chrome.exe', window_title: 'Stack Overflow - How to parse JSON in Node.js', time_spent_seconds: 300, reasoning: 'Researching JSON parsing for AI response handling' },
      { id: 's1-3', application_name: 'Code.exe', window_title: 'prompts.js - JIRAForge', time_spent_seconds: 900, reasoning: 'Updating AI prompts for better accuracy' },
      { id: 's1-4', application_name: 'WindowsTerminal.exe', window_title: 'node src/index.js - JIRAForge', time_spent_seconds: 120, reasoning: 'Running the AI server for testing' },
      { id: 's1-5', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 300, reasoning: 'Screen locked' },
      { id: 's1-6', application_name: 'Chrome.exe', window_title: 'Gemini API Documentation - Google AI', time_spent_seconds: 450, reasoning: 'Reading Gemini 2.5 Flash API documentation' },
      { id: 's1-7', application_name: 'Cursor.exe', window_title: 'ai-client.js - JIRAForge', time_spent_seconds: 720, reasoning: 'Modifying AI client to support Gemini 2.5 Flash' },
      { id: 's1-8', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 180, reasoning: 'Screen locked' },
    ],
    expectedGroups: 2,
    expectedWorkGroups: 1,
  },

  // ---------------------------------------------------------
  // SCENARIO 2: Multi-project switching
  // Tests: Can it separate two DIFFERENT projects being worked
  //        on in the same tools (VS Code on ProjectA vs ProjectB)?
  // ---------------------------------------------------------
  {
    name: 'Multi-Project Switching',
    description: 'Developer switches between an e-commerce project and an internal admin dashboard. Should produce 3 groups: 2 work + 1 idle.',
    issues: [
      { key: 'SHOP-10', summary: 'Add cart checkout flow', status: 'In Progress', description: 'Implement shopping cart with Stripe integration', labels: ['frontend', 'payments'] },
      { key: 'SHOP-11', summary: 'Fix product search filters', status: 'To Do', description: 'Search filters not applying correctly on catalog page', labels: ['bug', 'search'] },
      { key: 'ADMIN-5', summary: 'Build user management dashboard', status: 'In Progress', description: 'Admin panel to view, edit, and deactivate users', labels: ['admin', 'dashboard'] },
      { key: 'ADMIN-6', summary: 'Add role-based access control', status: 'To Do', description: 'Implement RBAC with admin, manager, viewer roles', labels: ['auth', 'security'] },
    ],
    sessions: [
      { id: 's2-1', application_name: 'Code.exe', window_title: 'CartCheckout.tsx - ecommerce-app', time_spent_seconds: 1200, reasoning: 'Building checkout form with Stripe Elements integration' },
      { id: 's2-2', application_name: 'Chrome.exe', window_title: 'Stripe Docs - Payment Intents', time_spent_seconds: 600, reasoning: 'Reading Stripe API docs for payment integration' },
      { id: 's2-3', application_name: 'Code.exe', window_title: 'UserTable.tsx - admin-dashboard', time_spent_seconds: 900, reasoning: 'Creating user management table with sort and filter' },
      { id: 's2-4', application_name: 'Chrome.exe', window_title: 'localhost:3001/admin/users', time_spent_seconds: 300, reasoning: 'Testing admin user management page locally' },
      { id: 's2-5', application_name: 'WindowsTerminal.exe', window_title: 'npm run dev - ecommerce-app', time_spent_seconds: 180, reasoning: 'Running ecommerce dev server' },
      { id: 's2-6', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 600, reasoning: 'Lunch break' },
      { id: 's2-7', application_name: 'Code.exe', window_title: 'RoleGuard.tsx - admin-dashboard', time_spent_seconds: 600, reasoning: 'Implementing role-based route guards' },
      { id: 's2-8', application_name: 'WindowsTerminal.exe', window_title: 'npm test - admin-dashboard', time_spent_seconds: 300, reasoning: 'Running admin dashboard unit tests' },
      { id: 's2-9', application_name: 'Code.exe', window_title: 'SearchFilters.tsx - ecommerce-app', time_spent_seconds: 450, reasoning: 'Debugging product search filter logic' },
    ],
    expectedGroups: 3,
    expectedWorkGroups: 2,
  },

  // ---------------------------------------------------------
  // SCENARIO 3: Communication-heavy day
  // Tests: Can it group Slack/Teams/Email about the same project
  //        together with coding on that project?
  // ---------------------------------------------------------
  {
    name: 'Communication-Heavy Day',
    description: 'Developer has many meetings, Slack conversations, and emails alongside coding. Should merge communication about a project with coding on that project.',
    issues: [
      { key: 'PROJ-20', summary: 'Launch v2.0 release', status: 'In Progress', description: 'Coordinate v2.0 release with QA, DevOps, and PM', labels: ['release', 'coordination'] },
      { key: 'PROJ-21', summary: 'Fix critical login bug', status: 'In Progress', description: 'Users reporting 500 error on login since last deploy', labels: ['bug', 'critical', 'auth'] },
      { key: 'PROJ-22', summary: 'Write release notes', status: 'To Do', description: 'Document all changes in v2.0 for customer communication', labels: ['docs'] },
    ],
    sessions: [
      { id: 's3-1', application_name: 'Slack.exe', window_title: '#proj-v2-release - "QA done, ready for staging"', time_spent_seconds: 300, reasoning: 'Discussing v2.0 release status in Slack channel' },
      { id: 's3-2', application_name: 'Code.exe', window_title: 'authController.js - webapp', time_spent_seconds: 900, reasoning: 'Debugging login 500 error, tracing auth middleware' },
      { id: 's3-3', application_name: 'Zoom.exe', window_title: 'Sprint Standup - Daily sync', time_spent_seconds: 900, reasoning: 'Daily standup meeting discussing sprint progress' },
      { id: 's3-4', application_name: 'Outlook.exe', window_title: 'RE: v2.0 Release Timeline - from PM', time_spent_seconds: 300, reasoning: 'Replying to PM about release timeline and blockers' },
      { id: 's3-5', application_name: 'Chrome.exe', window_title: 'Sentry - Error: 500 POST /api/auth/login', time_spent_seconds: 600, reasoning: 'Investigating login error traces in Sentry dashboard' },
      { id: 's3-6', application_name: 'Teams.exe', window_title: 'Chat with QA Lead - Login bug reproduction', time_spent_seconds: 300, reasoning: 'Discussing login bug reproduction steps with QA' },
      { id: 's3-7', application_name: 'Code.exe', window_title: 'sessionMiddleware.js - webapp', time_spent_seconds: 600, reasoning: 'Found the root cause: session expiry race condition' },
      { id: 's3-8', application_name: 'Slack.exe', window_title: '#proj-v2-release - "Login fix pushed to staging"', time_spent_seconds: 120, reasoning: 'Notifying team that login fix is on staging' },
      { id: 's3-9', application_name: 'Word.exe', window_title: 'v2.0 Release Notes Draft.docx', time_spent_seconds: 1200, reasoning: 'Writing release notes for v2.0 features and fixes' },
    ],
    expectedGroups: 3,
    expectedWorkGroups: 3,
  },

  // ---------------------------------------------------------
  // SCENARIO 4: Research-heavy day
  // Tests: Can it link browser research sessions to the coding
  //        sessions they support?
  // ---------------------------------------------------------
  {
    name: 'Research-Heavy Day',
    description: 'Developer spends half the day reading docs, tutorials, and Stack Overflow before implementing. Research should merge with implementation.',
    issues: [
      { key: 'API-15', summary: 'Migrate from REST to GraphQL', status: 'In Progress', description: 'Replace REST endpoints with GraphQL schema and resolvers', labels: ['backend', 'graphql'] },
      { key: 'API-16', summary: 'Add rate limiting to API', status: 'To Do', description: 'Implement rate limiting with Redis to prevent abuse', labels: ['security', 'backend'] },
    ],
    sessions: [
      { id: 's4-1', application_name: 'Chrome.exe', window_title: 'GraphQL Official Docs - Schema Design', time_spent_seconds: 900, reasoning: 'Reading GraphQL schema design best practices' },
      { id: 's4-2', application_name: 'Chrome.exe', window_title: 'YouTube - GraphQL Full Course 2024', time_spent_seconds: 1800, reasoning: 'Watching GraphQL tutorial for migration patterns' },
      { id: 's4-3', application_name: 'Chrome.exe', window_title: 'Stack Overflow - Apollo Server with Express', time_spent_seconds: 300, reasoning: 'Looking up Apollo Server Express integration' },
      { id: 's4-4', application_name: 'Code.exe', window_title: 'schema.graphql - webapp-api', time_spent_seconds: 1200, reasoning: 'Defining GraphQL schema types and queries' },
      { id: 's4-5', application_name: 'Code.exe', window_title: 'userResolvers.js - webapp-api', time_spent_seconds: 900, reasoning: 'Writing user query and mutation resolvers' },
      { id: 's4-6', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 300, reasoning: 'Coffee break' },
      { id: 's4-7', application_name: 'Chrome.exe', window_title: 'Redis Rate Limiting Patterns - Blog', time_spent_seconds: 600, reasoning: 'Researching Redis-based rate limiting strategies' },
      { id: 's4-8', application_name: 'Code.exe', window_title: 'rateLimiter.js - webapp-api', time_spent_seconds: 600, reasoning: 'Implementing Redis rate limiter middleware' },
      { id: 's4-9', application_name: 'WindowsTerminal.exe', window_title: 'redis-cli MONITOR', time_spent_seconds: 180, reasoning: 'Monitoring Redis while testing rate limiting' },
    ],
    expectedGroups: 3,
    expectedWorkGroups: 2,
  },

  // ---------------------------------------------------------
  // SCENARIO 5: Mixed work and personal
  // Tests: Can it separate non-office (YouTube entertainment,
  //        shopping) from office work?
  // ---------------------------------------------------------
  {
    name: 'Mixed Work and Personal',
    description: 'Developer mixes personal browsing (YouTube music, Amazon shopping, Reddit) with real coding work. Must correctly separate office vs non-office.',
    issues: [
      { key: 'FE-30', summary: 'Implement dark mode toggle', status: 'In Progress', description: 'Add theme switching with CSS variables and localStorage persistence', labels: ['frontend', 'ui'] },
      { key: 'FE-31', summary: 'Fix responsive layout on mobile', status: 'In Progress', description: 'Navigation and sidebar break on screens < 768px', labels: ['frontend', 'responsive', 'bug'] },
    ],
    sessions: [
      { id: 's5-1', application_name: 'Code.exe', window_title: 'ThemeProvider.tsx - webapp', time_spent_seconds: 900, reasoning: 'Building dark mode theme context provider' },
      { id: 's5-2', application_name: 'Chrome.exe', window_title: 'YouTube - Lo-fi beats to code to', time_spent_seconds: 3600, reasoning: 'Listening to background music while working' },
      { id: 's5-3', application_name: 'Chrome.exe', window_title: 'CSS Variables for Dark Mode - MDN', time_spent_seconds: 300, reasoning: 'Reading MDN docs on CSS custom properties' },
      { id: 's5-4', application_name: 'Chrome.exe', window_title: 'Amazon.com - Mechanical Keyboard', time_spent_seconds: 600, reasoning: 'Shopping for a new keyboard' },
      { id: 's5-5', application_name: 'Code.exe', window_title: 'variables.css - webapp', time_spent_seconds: 600, reasoning: 'Defining CSS variables for light and dark themes' },
      { id: 's5-6', application_name: 'Chrome.exe', window_title: 'Reddit - r/programming', time_spent_seconds: 300, reasoning: 'Browsing Reddit programming subreddit' },
      { id: 's5-7', application_name: 'Code.exe', window_title: 'Sidebar.tsx - webapp', time_spent_seconds: 600, reasoning: 'Fixing sidebar responsive breakpoints for mobile' },
      { id: 's5-8', application_name: 'Chrome.exe', window_title: 'localhost:3000 - Mobile viewport test', time_spent_seconds: 300, reasoning: 'Testing responsive layout in Chrome DevTools' },
      { id: 's5-9', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 180, reasoning: 'Short break' },
    ],
    expectedGroups: 4,
    expectedWorkGroups: 2,
  },

  // ---------------------------------------------------------
  // SCENARIO 6: Heavy idle with sparse work
  // Tests: Can it handle sessions dominated by idle/system apps
  //        and still correctly group the sparse work sessions?
  // ---------------------------------------------------------
  {
    name: 'Heavy Idle with Sparse Work',
    description: 'Mostly idle/locked screen with brief bursts of work. Tests separation of idle noise from small work periods.',
    issues: [
      { key: 'OPS-8', summary: 'Deploy monitoring dashboard', status: 'In Progress', description: 'Set up Grafana dashboards for production metrics', labels: ['devops', 'monitoring'] },
    ],
    sessions: [
      { id: 's6-1', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 1800, reasoning: 'Screen locked - morning arrival' },
      { id: 's6-2', application_name: 'Chrome.exe', window_title: 'Grafana - New Dashboard', time_spent_seconds: 900, reasoning: 'Creating new Grafana dashboard panels for CPU and memory' },
      { id: 's6-3', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 3600, reasoning: 'Long meeting, screen locked' },
      { id: 's6-4', application_name: 'WindowsTerminal.exe', window_title: 'ssh prod-server - top', time_spent_seconds: 300, reasoning: 'Checking production server resource usage' },
      { id: 's6-5', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 1800, reasoning: 'Lunch break' },
      { id: 's6-6', application_name: 'Chrome.exe', window_title: 'Grafana - Edit Panel: API Response Times', time_spent_seconds: 600, reasoning: 'Adding API response time chart to monitoring dashboard' },
      { id: 's6-7', application_name: 'ScreenSaver.exe', window_title: 'Screen Saver', time_spent_seconds: 900, reasoning: 'Screensaver active' },
      { id: 's6-8', application_name: 'Code.exe', window_title: 'docker-compose.yml - infra', time_spent_seconds: 300, reasoning: 'Updating Grafana container config for new data source' },
      { id: 's6-9', application_name: 'LockApp.exe', window_title: 'Windows Lock Screen', time_spent_seconds: 1200, reasoning: 'End of day lock' },
    ],
    expectedGroups: 2,
    expectedWorkGroups: 1,
  },
];

// ============================================================
// HELPERS
// ============================================================

const SYSTEM_APPS = ['lockapp', 'lock', 'screensaver', 'logonui', 'shutdown', 'idle'];

function isSystemApp(appName) {
  if (!appName) return false;
  const normalized = appName.toLowerCase().replace('.exe', '').replace(/\s+/g, '').trim();
  return SYSTEM_APPS.some(s => normalized.includes(s));
}

function formatAssignedIssues(issues) {
  if (!issues || issues.length === 0) return 'None - track all work';
  return issues.slice(0, 20).map(issue => {
    let t = `- ${issue.key}: ${issue.summary} (Status: ${issue.status})`;
    if (issue.description) t += `\n  Description: ${issue.description.substring(0, 200)}`;
    if (issue.labels?.length) t += `\n  Labels: ${issue.labels.join(', ')}`;
    return t;
  }).join('\n');
}

function buildSessionDescriptions(sessions) {
  return sessions.map((session, index) => {
    const app = (session.application_name || 'Unknown').replace('.exe', '');
    const isSys = isSystemApp(session.application_name);
    return `Session ${index + 1} (ID: ${session.id}, Time: ${session.time_spent_seconds}s):
Application: ${app}${isSys ? ' [SYSTEM/IDLE - DO NOT MIX WITH WORK]' : ''}
Window Title: ${session.window_title || 'Unknown'}
Activity Description: ${session.reasoning || 'No description'}
Duration: ${Math.round((session.time_spent_seconds || 0) / 60)} minutes`;
  }).join('\n\n');
}

function extractJson(content) {
  const m = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
  return m ? m[1].trim() : content.trim();
}

function safeParse(content) {
  try { return JSON.parse(extractJson(content)); } catch { return null; }
}

function printSep(c = '=', n = 80) { console.log(c.repeat(n)); }
function printHeader(t) { console.log(''); printSep(); console.log(`  ${t}`); printSep(); }

// ============================================================
// SCORING
// ============================================================

function scoreResult(parsed, scenario) {
  if (!parsed || !parsed.groups) return { total: 0, details: 'PARSE FAILURE' };

  const groups = parsed.groups;
  let score = 0;
  const details = [];

  // 1. Group count penalty (fewer is better, within reason)
  const groupDiff = Math.abs(groups.length - scenario.expectedGroups);
  const groupScore = Math.max(0, 30 - groupDiff * 10);
  score += groupScore;
  details.push(`Group count: ${groups.length} (expected ~${scenario.expectedGroups}) => ${groupScore}/30`);

  // 2. Orphan penalty (single-session groups are bad)
  const orphans = groups.filter(g => (g.session_indices?.length || 0) === 1).length;
  const orphanScore = Math.max(0, 20 - orphans * 5);
  score += orphanScore;
  details.push(`Orphan groups: ${orphans} => ${orphanScore}/20`);

  // 3. Idle separation (system apps must NOT be in work groups)
  const allSessionIndices = [];
  let idleCorrect = true;
  groups.forEach(g => {
    const isIdleGroup = g.label?.toLowerCase().includes('idle') || g.label?.toLowerCase().includes('break');
    (g.session_indices || []).forEach(idx => {
      const session = scenario.sessions[idx - 1];
      if (!session) return;
      if (isSystemApp(session.application_name) && !isIdleGroup) idleCorrect = false;
      if (!isSystemApp(session.application_name) && isIdleGroup) idleCorrect = false;
      allSessionIndices.push(idx);
    });
  });
  const idleScore = idleCorrect ? 20 : 0;
  score += idleScore;
  details.push(`Idle separation: ${idleCorrect ? 'CORRECT' : 'MIXED!'} => ${idleScore}/20`);

  // 4. Jira match quality (did it suggest relevant issues?)
  let jiraMatches = 0;
  const issueKeys = scenario.issues.map(i => i.key);
  groups.forEach(g => {
    const suggested = g.recommendation?.suggested_issue_key;
    if (suggested && issueKeys.includes(suggested)) jiraMatches++;
  });
  const workGroupCount = groups.filter(g => {
    const isIdle = g.label?.toLowerCase().includes('idle') || g.label?.toLowerCase().includes('break');
    return !isIdle;
  }).length;
  const jiraScore = workGroupCount > 0 ? Math.round((jiraMatches / workGroupCount) * 15) : 0;
  score += jiraScore;
  details.push(`Jira matches: ${jiraMatches}/${workGroupCount} work groups => ${jiraScore}/15`);

  // 5. Coverage (all sessions accounted for?)
  const uniqueIndices = new Set(allSessionIndices);
  const coverageRatio = uniqueIndices.size / scenario.sessions.length;
  const coverageScore = Math.round(coverageRatio * 15);
  score += coverageScore;
  details.push(`Coverage: ${uniqueIndices.size}/${scenario.sessions.length} sessions => ${coverageScore}/15`);

  return { total: score, max: 100, details };
}

// ============================================================
// RUN ONE CLUSTERING SCENARIO
// ============================================================

async function runClusteringScenario(scenario, scenarioNum) {
  printHeader(`SCENARIO ${scenarioNum}: ${scenario.name}`);
  console.log(`  ${scenario.description}`);
  console.log(`  Sessions: ${scenario.sessions.length} | Issues: ${scenario.issues.map(i => i.key).join(', ')}`);
  console.log(`  Expected: ~${scenario.expectedGroups} groups (${scenario.expectedWorkGroups} work + idle)\n`);

  const sessionDescriptions = buildSessionDescriptions(scenario.sessions);
  const issuesContext = scenario.issues.map(i => `- ${i.key}: ${i.summary}`).join('\n');
  const systemCount = scenario.sessions.filter(s => isSystemApp(s.application_name)).length;
  const workCount = scenario.sessions.filter(s => !isSystemApp(s.application_name)).length;

  // --- OLD ---
  console.log('  Running OLD prompt...');
  let oldParsed = null, oldProvider = '?', oldModel = '?';
  try {
    const r = await chatCompletionWithFallback({
      messages: [
        { role: 'system', content: OLD_CLUSTERING_SYSTEM_PROMPT },
        { role: 'user', content: buildOldClusteringUserPrompt(sessionDescriptions, issuesContext, systemCount, workCount) }
      ],
      temperature: 0.2, max_tokens: 4000, isVision: false
    });
    oldParsed = safeParse(r.response.choices[0].message.content.trim());
    oldProvider = r.provider; oldModel = r.model;
    console.log(`    Done (${oldProvider})`);
  } catch (e) { console.log(`    FAILED: ${e.message}`); }

  // --- NEW ---
  console.log('  Running NEW prompt...');
  let newParsed = null, newProvider = '?', newModel = '?';
  try {
    const r = await chatCompletionWithFallback({
      messages: [
        { role: 'system', content: NEW_CLUSTERING_SYSTEM_PROMPT },
        { role: 'user', content: buildNewClusteringUserPrompt(sessionDescriptions, issuesContext, systemCount, workCount) }
      ],
      temperature: 0.2, max_tokens: 4000, isVision: false
    });
    newParsed = safeParse(r.response.choices[0].message.content.trim());
    newProvider = r.provider; newModel = r.model;
    console.log(`    Done (${newProvider})`);
  } catch (e) { console.log(`    FAILED: ${e.message}`); }

  // --- RESULTS ---
  const oldScore = scoreResult(oldParsed, scenario);
  const newScore = scoreResult(newParsed, scenario);

  console.log(`\n  ${'~'.repeat(35)} OLD (${oldProvider}) ${'~'.repeat(35)}`);
  if (oldParsed) {
    (oldParsed.groups || []).forEach((g, i) => {
      console.log(`    ${i + 1}. "${g.label}" [${g.session_indices?.length || 0} sessions, ${g.confidence}]`);
      console.log(`       ${(g.description || '').substring(0, 100)}`);
      if (g.recommendation?.suggested_issue_key && g.recommendation.suggested_issue_key !== 'null') {
        console.log(`       -> ${g.recommendation.suggested_issue_key}`);
      }
    });
  } else { console.log('    PARSE FAILED'); }

  console.log(`\n  ${'~'.repeat(35)} NEW (${newProvider}) ${'~'.repeat(35)}`);
  if (newParsed) {
    (newParsed.groups || []).forEach((g, i) => {
      console.log(`    ${i + 1}. "${g.label}" [${g.session_indices?.length || 0} sessions, ${g.confidence}]`);
      console.log(`       ${(g.description || '').substring(0, 100)}`);
      if (g.recommendation?.suggested_issue_key && g.recommendation.suggested_issue_key !== 'null') {
        console.log(`       -> ${g.recommendation.suggested_issue_key}`);
      }
    });
  } else { console.log('    PARSE FAILED'); }

  // --- SCORE ---
  console.log(`\n  ${'~'.repeat(30)} SCORE ${'~'.repeat(30)}`);
  console.log(`  OLD: ${oldScore.total}/100`);
  oldScore.details?.forEach?.(d => console.log(`    - ${d}`));
  console.log(`  NEW: ${newScore.total}/100`);
  newScore.details?.forEach?.(d => console.log(`    - ${d}`));

  const winner = oldScore.total > newScore.total ? 'OLD' : newScore.total > oldScore.total ? 'NEW' : 'TIE';
  console.log(`\n  WINNER: ${winner} (OLD=${oldScore.total} vs NEW=${newScore.total})`);

  return { scenario: scenarioNum, name: scenario.name, oldScore: oldScore.total, newScore: newScore.total, winner };
}

// ============================================================
// VISION A/B TEST
// ============================================================

async function runVisionComparison(screenshotPath) {
  printHeader('VISION PROMPT A/B COMPARISON');

  const imageBuffer = fs.readFileSync(screenshotPath);
  const base64Image = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/png;base64,${base64Image}`;
  const issues = SCENARIOS[0].issues;
  const assignedIssuesText = formatAssignedIssues(issues);
  const applicationName = 'Code.exe';
  const windowTitle = path.basename(screenshotPath, path.extname(screenshotPath));

  console.log(`  Screenshot: ${screenshotPath}`);
  console.log(`  Issues: ${issues.map(i => i.key).join(', ')}`);

  let oldParsed = null, newParsed = null;

  console.log('\n  Running OLD vision prompt...');
  try {
    const r = await chatCompletionWithFallback({
      messages: [
        { role: 'system', content: OLD_VISION_SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: buildOldVisionUserPrompt(applicationName, windowTitle, assignedIssuesText) },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
        ]}
      ], temperature: 0.3, max_tokens: 800, isVision: true
    });
    oldParsed = safeParse(r.response.choices[0].message.content.trim());
    console.log(`    Done (${r.provider})`);
  } catch (e) { console.log(`    FAILED: ${e.message}`); }

  console.log('  Running NEW vision prompt...');
  try {
    const r = await chatCompletionWithFallback({
      messages: [
        { role: 'system', content: NEW_VISION_SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: buildNewVisionUserPrompt(applicationName, windowTitle, assignedIssuesText) },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } }
        ]}
      ], temperature: 0.3, max_tokens: 800, isVision: true
    });
    newParsed = safeParse(r.response.choices[0].message.content.trim());
    console.log(`    Done (${r.provider})`);
  } catch (e) { console.log(`    FAILED: ${e.message}`); }

  if (oldParsed) {
    console.log('\n  OLD Vision Result:');
    console.log(`    taskKey=${oldParsed.taskKey} confidence=${oldParsed.confidenceScore} workType=${oldParsed.workType}`);
    console.log(`    reasoning: ${(oldParsed.reasoning || '').substring(0, 120)}`);
  }
  if (newParsed) {
    console.log('\n  NEW Vision Result:');
    console.log(`    taskKey=${newParsed.taskKey} confidence=${newParsed.confidenceScore} workType=${newParsed.workType}`);
    console.log(`    thought_process: ${(newParsed.thought_process || '').substring(0, 120)}`);
  }
  if (oldParsed && newParsed) {
    const match = oldParsed.taskKey === newParsed.taskKey;
    console.log(`\n  TASK KEY MATCH: ${match ? 'YES' : 'NO'} (OLD=${oldParsed.taskKey} NEW=${newParsed.taskKey})`);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  let screenshotPath = null;
  let specificScenario = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scenario' && args[i + 1]) {
      specificScenario = parseInt(args[i + 1]);
      i++;
    } else if (!args[i].startsWith('--')) {
      screenshotPath = args[i];
    }
  }

  console.log('');
  printSep('*');
  console.log('  AI PROMPT A/B COMPARISON - MULTI-SCENARIO TEST');
  printSep('*');

  console.log('\nInitializing AI clients...');
  initializeClient();

  // Vision test
  if (screenshotPath) {
    const resolved = path.resolve(screenshotPath);
    if (!fs.existsSync(resolved)) { console.error(`Screenshot not found: ${resolved}`); process.exit(1); }
    await runVisionComparison(resolved);
  }

  // Clustering tests
  const scenariosToRun = specificScenario
    ? [{ scenario: SCENARIOS[specificScenario - 1], num: specificScenario }]
    : SCENARIOS.map((s, i) => ({ scenario: s, num: i + 1 }));

  const results = [];
  for (const { scenario, num } of scenariosToRun) {
    if (!scenario) { console.log(`Scenario ${num} not found`); continue; }
    const result = await runClusteringScenario(scenario, num);
    results.push(result);
  }

  // --- FINAL SUMMARY ---
  printHeader('FINAL SUMMARY');

  let oldWins = 0, newWins = 0, ties = 0;
  let oldTotal = 0, newTotal = 0;

  console.log('  Scenario                           OLD    NEW    Winner');
  console.log('  ' + '-'.repeat(65));
  results.forEach(r => {
    const name = r.name.padEnd(35);
    console.log(`  ${name} ${String(r.oldScore).padStart(3)}/100  ${String(r.newScore).padStart(3)}/100  ${r.winner}`);
    oldTotal += r.oldScore;
    newTotal += r.newScore;
    if (r.winner === 'OLD') oldWins++;
    else if (r.winner === 'NEW') newWins++;
    else ties++;
  });

  console.log('  ' + '-'.repeat(65));
  console.log(`  TOTAL                              ${String(oldTotal).padStart(3)}     ${String(newTotal).padStart(3)}`);
  console.log(`\n  OLD wins: ${oldWins} | NEW wins: ${newWins} | Ties: ${ties}`);
  console.log(`  OVERALL: ${oldTotal > newTotal ? 'OLD prompts are better' : newTotal > oldTotal ? 'NEW prompts are better' : 'TIE'}\n`);
}

main().catch(err => {
  console.error('\nTest failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
