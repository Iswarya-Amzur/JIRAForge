/**
 * Navigation utility functions for Jira integration
 */

/**
 * Navigate to a Jira issue (works within Forge iframe)
 * @param {string} issueKey - The Jira issue key (e.g., "PROJ-123")
 */
export const navigateToIssue = (issueKey) => {
  try {
    if (window.parent && window.parent !== window) {
      // Use parent window to navigate (works in Forge iframe)
      window.parent.location.href = `/browse/${issueKey}`;
    } else {
      // Fallback to same window
      window.location.href = `/browse/${issueKey}`;
    }
  } catch (e) {
    // If cross-origin restrictions prevent parent navigation,
    // the link href will handle it as a fallback
    console.warn('Could not navigate programmatically, using link fallback');
  }
};

/**
 * Get the initial tab from URL hash
 * @returns {string} The initial tab name
 */
export const getInitialTab = () => {
  try {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['dashboard', 'analytics', 'unassigned-work', 'org-analytics', 'timesheet-settings'];
    if (hash && validTabs.includes(hash)) {
      return hash;
    }
  } catch (e) {
    // Ignore errors in Forge iframe context
  }
  return 'dashboard';
};
