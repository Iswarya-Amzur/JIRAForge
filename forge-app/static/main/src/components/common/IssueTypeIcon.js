import React from 'react';
import './IssueTypeIcon.css';

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
      <span className="issue-type-icon-wrapper">
        <img
          src={iconUrl}
          alt={issueType || 'Issue'}
          className="issue-type-icon jira-icon"
        />
        <span className="issue-type-tooltip">{issueType || 'Issue'}</span>
      </span>
    );
  }

  // SVG icons matching Jira's style
  const svgIcons = {
    'Story': (
      <span className="issue-type-icon-wrapper">
        <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
          <path
            d="M4 2h8a1 1 0 011 1v11.586a.5.5 0 01-.853.354L8 10.793l-4.147 4.147A.5.5 0 013 14.586V3a1 1 0 011-1z"
            fill="#63BA3C"
          />
        </svg>
        <span className="issue-type-tooltip">Story</span>
      </span>
    ),
    'Task': (
      <span className="issue-type-icon-wrapper">
        <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="14" rx="2" fill="#4FADE6"/>
          <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="issue-type-tooltip">Task</span>
      </span>
    ),
    'Bug': (
      <span className="issue-type-icon-wrapper">
        <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="7" fill="#E5493A"/>
          <circle cx="8" cy="8" r="3" fill="white"/>
        </svg>
        <span className="issue-type-tooltip">Bug</span>
      </span>
    ),
    'Epic': (
      <span className="issue-type-icon-wrapper">
        <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
          <path d="M8 1L2 9h5v6l6-8H8V1z" fill="#904EE2"/>
        </svg>
        <span className="issue-type-tooltip">Epic</span>
      </span>
    ),
    'Sub-task': (
      <span className="issue-type-icon-wrapper">
        <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="14" rx="2" fill="#4FADE6"/>
          <rect x="4" y="7" width="8" height="2" fill="white"/>
        </svg>
        <span className="issue-type-tooltip">Sub-task</span>
      </span>
    ),
    'Feature': (
      <span className="issue-type-icon-wrapper">
        <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="14" rx="2" fill="#63BA3C"/>
          <circle cx="5" cy="5" r="1.5" fill="white"/>
          <circle cx="11" cy="5" r="1.5" fill="white"/>
          <circle cx="5" cy="11" r="1.5" fill="white"/>
          <circle cx="11" cy="11" r="1.5" fill="white"/>
        </svg>
        <span className="issue-type-tooltip">Feature</span>
      </span>
    ),
    'Request': (
      <span className="issue-type-icon-wrapper">
        <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="14" rx="2" fill="#2684FF"/>
          <path d="M8 4v8M4 8h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span className="issue-type-tooltip">Request</span>
      </span>
    ),
    'Improvement': (
      <span className="issue-type-icon-wrapper">
        <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="14" rx="2" fill="#63BA3C"/>
          <path d="M8 4v8M5 7l3-3 3 3" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="issue-type-tooltip">Improvement</span>
      </span>
    )
  };

  // Return SVG icon if available, otherwise a default
  if (svgIcons[issueType]) {
    return svgIcons[issueType];
  }

  // Default fallback icon
  return (
    <span className="issue-type-icon-wrapper">
      <svg className="issue-type-icon svg-icon" viewBox="0 0 16 16">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#6B778C"/>
        <path d="M5 8h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <span className="issue-type-tooltip">{issueType || 'Issue'}</span>
    </span>
  );
}

export default IssueTypeIcon;
