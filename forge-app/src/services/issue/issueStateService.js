/**
 * Issue State Service
 * Handles issue status transitions
 */

import { getIssueTransitions, transitionIssue } from '../../utils/jira.js';

/**
 * Get available status transitions for an issue
 * @param {string} issueKey - Jira issue key (e.g., SCRUM-5)
 * @returns {Promise<Array>} Array of available transitions
 */
export async function getAvailableTransitions(issueKey) {
  try {
    const transitions = await getIssueTransitions(issueKey);

    return transitions.map(transition => ({
      id: transition.id,
      name: transition.name,
      to: {
        id: transition.to.id,
        name: transition.to.name,
        statusCategory: transition.to.statusCategory?.key || 'new'
      }
    }));
  } catch (error) {
    console.error(`Error getting transitions for ${issueKey}:`, error);
    throw new Error(`Failed to get available transitions: ${error.message}`);
  }
}

/**
 * Update issue status by transitioning to new status
 * @param {string} issueKey - Jira issue key (e.g., SCRUM-5)
 * @param {string} transitionId - Transition ID to execute
 * @returns {Promise<Object>} Update result
 */
export async function updateIssueStatus(issueKey, transitionId) {
  try {
    const result = await transitionIssue(issueKey, transitionId);

    return {
      success: true,
      issueKey,
      transitionId,
      message: `Successfully updated ${issueKey} status`
    };
  } catch (error) {
    console.error(`Error updating status for ${issueKey}:`, error);
    throw new Error(`Failed to update issue status: ${error.message}`);
  }
}
