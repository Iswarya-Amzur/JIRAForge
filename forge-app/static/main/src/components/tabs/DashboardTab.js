import React, { useState, useEffect } from 'react';
import { useApp } from '../../context';
import { IssueTypeIcon, StatusDropdown } from '../common';
import { navigateToIssue, formatTime } from '../../utils';
import './DashboardTab.css';

function DashboardTab({ onOpenScreenshotPreview, onOpenReassignModal }) {
  const {
    activeIssues,
    issuesLoading,
    loadActiveIssues,
    statusUpdating,
    handleStatusChange,
    loadTransitionsForIssue
  } = useApp();

  const [issueFilter, setIssueFilter] = useState('all');

  useEffect(() => {
    loadActiveIssues();
  }, [loadActiveIssues]);

  const filteredIssues = activeIssues.filter(issue => {
    if (issueFilter === 'all') return true;
    if (issueFilter === 'in-progress') return issue.statusCategory === 'indeterminate';
    if (issueFilter === 'done') return issue.statusCategory === 'done';
    return true;
  });

  const handleExpandClick = (e) => {
    e.preventDefault();
    const button = e.target.closest('.expand-button');
    const row = button.closest('tr');
    const detailsRow = row.nextElementSibling;
    if (detailsRow && detailsRow.classList.contains('details-row')) {
      detailsRow.classList.toggle('show');
      button.classList.toggle('expanded', detailsRow.classList.contains('show'));
    }
  };

  const groupSessionsByDate = (sessions) => {
    return sessions.reduce((acc, session) => {
      const dateKey = session.date;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(session);
      return acc;
    }, {});
  };

  const calculateTotalDuration = (sessions) => {
    return sessions.reduce((sum, s) => {
      return sum + (s.duration || Math.round((new Date(s.endTime) - new Date(s.startTime)) / 1000));
    }, 0);
  };

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>

      <div className="my-focus-widget">
        <h2>My Focus</h2>
        <p className="widget-subtitle">Your personalized development workflow hub</p>

        <div className="focus-tabs">
          <button
            className={issueFilter === 'all' ? 'active' : ''}
            onClick={() => setIssueFilter('all')}
          >
            All Issues
          </button>
          <button
            className={issueFilter === 'in-progress' ? 'active' : ''}
            onClick={() => setIssueFilter('in-progress')}
          >
            In Progress
          </button>
          <button
            className={issueFilter === 'done' ? 'active' : ''}
            onClick={() => setIssueFilter('done')}
          >
            Done
          </button>
        </div>

        {issuesLoading ? (
          <p className="loading-text">Loading issues...</p>
        ) : (
          <>
            {filteredIssues.length > 0 ? (
              <div className="issues-table-container">
                <table className="issues-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Time Tracked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map((issue, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={issue.sessions?.length > 0 ? 'expandable-row' : ''}>
                          <td className="issue-key">
                            {issue.sessions?.length > 0 && (
                              <button className="expand-button" onClick={handleExpandClick}>
                                ›
                              </button>
                            )}
                            <IssueTypeIcon
                              issueType={issue.issueType}
                              iconUrl={issue.issueTypeIconUrl}
                            />
                            <a
                              href={`/browse/${issue.key}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigateToIssue(issue.key);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {issue.key}
                            </a>
                          </td>
                          <td className="issue-title">{issue.summary}</td>
                          <td className="issue-status">
                            <StatusDropdown
                              issue={issue}
                              onStatusChange={handleStatusChange}
                              isUpdating={statusUpdating === issue.key}
                              onLoadTransitions={loadTransitionsForIssue}
                            />
                          </td>
                          <td className="issue-priority">
                            <span className={`priority-badge priority-${issue.priority.toLowerCase()}`}>
                              {issue.priority}
                            </span>
                          </td>
                          <td className="issue-time">
                            {issue.timeTracked > 0 ? formatTime(issue.timeTracked) : '-'}
                          </td>
                        </tr>
                        {issue.sessions?.length > 0 && (
                          <tr className="details-row">
                            <td colSpan="5">
                              <div className="session-details">
                                <h4>Work Sessions ({issue.sessions.length})</h4>
                                <div className="sessions-by-date">
                                  {Object.keys(groupSessionsByDate(issue.sessions))
                                    .sort((a, b) => new Date(b) - new Date(a))
                                    .map((dateKey, dateIdx) => {
                                      const dateSessions = groupSessionsByDate(issue.sessions)[dateKey];
                                      const displayDate = new Date(dateKey);
                                      const totalDuration = calculateTotalDuration(dateSessions);

                                      return (
                                        <div key={dateIdx} className="date-group">
                                          <div className="date-header">
                                            <span className="date-label">
                                              {displayDate.toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                              })}
                                            </span>
                                            <span className="date-total">
                                              Total: {formatTime(totalDuration)}
                                            </span>
                                          </div>
                                          <div className="sessions-list">
                                            {dateSessions.map((session, sessionIdx) => {
                                              const start = new Date(session.startTime);
                                              const end = new Date(session.endTime);
                                              const sessionDuration = session.duration ||
                                                Math.round((end - start) / 1000);

                                              return (
                                                <div key={sessionIdx} className="session-item">
                                                  <span className="session-time">
                                                    {start.toLocaleTimeString('en-US', {
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                      hour12: true
                                                    })}
                                                    {' → '}
                                                    {end.toLocaleTimeString('en-US', {
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                      hour12: true
                                                    })}
                                                  </span>
                                                  <span className="session-duration">
                                                    {formatTime(sessionDuration)}
                                                  </span>
                                                  <div className="session-actions">
                                                    {session.screenshots?.length > 0 && (
                                                      <button
                                                        className="view-screenshots-button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          onOpenScreenshotPreview(session, issue.key);
                                                        }}
                                                        title={`View ${session.screenshots.length} screenshot${session.screenshots.length > 1 ? 's' : ''}`}
                                                      >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                          <polyline points="21 15 16 10 5 21"></polyline>
                                                        </svg>
                                                        {session.screenshots.length}
                                                      </button>
                                                    )}
                                                    {session.analysisResultIds?.length > 0 && (
                                                      <button
                                                        className="reassign-button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          onOpenReassignModal(session, issue.key);
                                                        }}
                                                        title="Reassign this session to a different issue"
                                                      >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">
                No {issueFilter !== 'all' ? issueFilter.replace('-', ' ') : ''} issues found.
                Start working on issues to see them here!
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardTab;
