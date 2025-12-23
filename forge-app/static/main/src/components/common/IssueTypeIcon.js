import React from 'react';

/**
 * Issue Type Icon Component - displays Jira-like icons for issue types
 * @param {Object} props
 * @param {string} props.issueType - The type of issue (Story, Task, Bug, etc.)
 * @param {string} props.iconUrl - Optional URL for a custom icon from Jira
 */
function IssueTypeIcon({ issueType, iconUrl }) {
  // If we have an icon URL from Jira, use it
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={issueType || 'Issue'}
        className="issue-type-icon jira-icon"
        title={issueType || 'Issue'}
      />
    );
  }

  // SVG icons matching Jira's style
  const svgIcons = {
    'Story': (
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title="Story">
        <path
          d="M4 2h8a1 1 0 011 1v11.586a.5.5 0 01-.853.354L8 10.793l-4.147 4.147A.5.5 0 013 14.586V3a1 1 0 011-1z"
          fill="#63BA3C"
        />
      </svg>
    ),
    'Task': (
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title="Task">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#4FADE6"/>
        <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'Bug': (
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title="Bug">
        <circle cx="8" cy="8" r="7" fill="#E5493A"/>
        <circle cx="8" cy="8" r="3" fill="white"/>
      </svg>
    ),
    'Epic': (
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title="Epic">
        <path d="M8 1L2 9h5v6l6-8H8V1z" fill="#904EE2"/>
      </svg>
    ),
    'Sub-task': (
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title="Sub-task">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#4FADE6"/>
        <rect x="4" y="7" width="8" height="2" fill="white"/>
      </svg>
    ),
    'Feature': (
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title="Feature">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#63BA3C"/>
        <circle cx="5" cy="5" r="1.5" fill="white"/>
        <circle cx="11" cy="5" r="1.5" fill="white"/>
        <circle cx="5" cy="11" r="1.5" fill="white"/>
        <circle cx="11" cy="11" r="1.5" fill="white"/>
      </svg>
    ),
    'Request': (
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title="Request">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#2684FF"/>
        <path d="M8 4v8M4 8h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    'Improvement': (
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title="Improvement">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#63BA3C"/>
        <path d="M8 4v8M5 7l3-3 3 3" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  };

  // Return SVG icon if available, otherwise a default
  if (svgIcons[issueType]) {
    return svgIcons[issueType];
  }

  // Default fallback icon
  return (
    <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16" title={issueType || 'Issue'}>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#6B778C"/>
      <path d="M5 8h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default IssueTypeIcon;
