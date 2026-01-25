import React from 'react';
import { formatTime } from '../../utils';

/**
 * Session Reassign Modal Component
 * Modal for reassigning time sessions between issues
 */
function SessionReassignModal({
  isOpen,
  sessionToReassign,
  activeIssues,
  reassigning,
  onClose,
  onReassign
}) {
  if (!isOpen || !sessionToReassign) return null;

  // Filter out the current issue and any "Done" issues (only show active/in-progress issues)
  const filteredIssues = activeIssues.filter(
    issue => issue.key !== sessionToReassign.fromIssueKey &&
             issue.statusCategory !== 'done'
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content reassign-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Reassign Session</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p className="reassign-info">
            Moving <strong>{formatTime(sessionToReassign.session.duration)}</strong> from{' '}
            <strong>{sessionToReassign.fromIssueKey}</strong>
          </p>
          <p className="reassign-prompt">Select the issue to reassign this time to:</p>
          <div className="issue-list-modal">
            {filteredIssues.map(issue => (
              <button
                key={issue.key}
                className="issue-option"
                onClick={() => onReassign(issue.key)}
                disabled={reassigning}
              >
                <span className="issue-key">{issue.key}</span>
                <span className="issue-summary">{issue.summary}</span>
                <span className={`status-badge status-${issue.statusCategory}`}>
                  {issue.status}
                </span>
              </button>
            ))}
            {filteredIssues.length === 0 && (
              <p className="empty-state">No other issues available for reassignment.</p>
            )}
          </div>
        </div>
        {reassigning && (
          <div className="modal-footer">
            <span className="reassigning-text">Reassigning...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionReassignModal;
