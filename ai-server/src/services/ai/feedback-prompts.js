/**
 * Feedback AI Prompts Module
 * Prompts for analyzing user feedback and generating Jira ticket content
 */

/**
 * System prompt for feedback analysis
 */
const FEEDBACK_ANALYSIS_SYSTEM_PROMPT = `You are an expert product feedback analyst. You analyze user-submitted feedback (bug reports, feature requests, improvements) and generate structured Jira ticket content. You produce clear, actionable summaries and accurate categorization.`;

/**
 * Build the user prompt for feedback analysis
 * @param {Object} feedback - Feedback data
 * @param {string} feedback.category - User-selected category
 * @param {string} feedback.title - User-provided title (may be empty)
 * @param {string} feedback.description - User-provided description
 * @returns {string} Complete user prompt
 */
function buildFeedbackAnalysisPrompt({ category, title, description }) {
  return `Analyze the following user feedback and generate structured content for a Jira ticket.

## User Feedback
- Category: ${category}
- Title: ${title || '(not provided - please generate one)'}
- Description: ${description}

## Instructions
1. Generate a concise, clear title if the user didn't provide one (or improve the existing one)
2. Write a well-structured description/summary suitable for a Jira ticket
3. Determine the appropriate Jira issue type (Bug, Story, Task, or Improvement)
4. Suggest a priority level (Highest, High, Medium, Low, Lowest)
5. Suggest up to 3 relevant labels

## Rules
- The summary should be professional and actionable
- For bugs: include "Steps to reproduce" and "Expected vs Actual behavior" sections if inferable
- For features: include "User Story" format if possible
- Labels should be lowercase, hyphenated (e.g., "ui-bug", "performance", "user-experience")
- Priority should reflect the severity/impact described

Return ONLY valid JSON (no markdown code blocks, no extra text):
{
  "title": "Clear, concise ticket title",
  "summary": "Well-structured description for the Jira ticket body",
  "issueType": "Bug" | "Story" | "Task" | "Improvement",
  "priority": "Highest" | "High" | "Medium" | "Low" | "Lowest",
  "labels": ["label-1", "label-2"]
}`;
}

module.exports = {
  FEEDBACK_ANALYSIS_SYSTEM_PROMPT,
  buildFeedbackAnalysisPrompt
};
