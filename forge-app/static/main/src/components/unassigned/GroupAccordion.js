import React, { useState } from 'react';
import { invoke } from '@forge/bridge';
import { formatTime } from '../../utils';
import './GroupAccordion.css';

function GroupAccordion({
  groups,
  hasMoreGroups,
  totalGroups,
  loadingMore,
  onLoadMore,
  onAssignClick
}) {
  // Accordion states
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [groupWorkSessions, setGroupWorkSessions] = useState({});
  const [loadingWorkSessions, setLoadingWorkSessions] = useState({});
  const [groupDetails, setGroupDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  const formatTimeOfDay = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSessionDuration = (session) => {
    // Use actual tracked duration from backend (sum of screenshot durations)
    // Fall back to calculated time span for backwards compatibility
    if (session.durationSeconds !== undefined && session.durationSeconds !== null) {
      return session.durationSeconds;
    }
    // Fallback: calculate from time span (less accurate for merged sessions)
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    return Math.round((end - start) / 1000);
  };

  const toggleGroup = async (groupId) => {
    const newExpanded = new Set(expandedGroups);

    if (newExpanded.has(groupId)) {
      // Collapse
      newExpanded.delete(groupId);
    } else {
      // Expand - load group details and work sessions if not already loaded
      newExpanded.add(groupId);

      // LAZY LOADING: Load group details (session_ids) if not cached
      if (!groupDetails[groupId]) {
        setLoadingDetails(prev => ({ ...prev, [groupId]: true }));
        try {
          const detailsResult = await invoke('getGroupDetails', { groupId });

          if (detailsResult.success) {
            setGroupDetails(prev => ({ ...prev, [groupId]: detailsResult }));

            // Now load work sessions using the session_ids from details
            if (detailsResult.session_ids && detailsResult.session_ids.length > 0) {
              setLoadingWorkSessions(prev => ({ ...prev, [groupId]: true }));
              try {
                const sessionsResult = await invoke('getGroupWorkSessions', {
                  sessionIds: detailsResult.session_ids
                });
                if (sessionsResult.success) {
                  setGroupWorkSessions(prev => ({
                    ...prev,
                    [groupId]: sessionsResult.dateGroups || []
                  }));
                }
              } catch (err) {
                console.error('Error loading work sessions for group:', err);
              } finally {
                setLoadingWorkSessions(prev => ({ ...prev, [groupId]: false }));
              }
            }
          } else {
            console.error('[GroupAccordion] Failed to load group details:', detailsResult.error);
          }
        } catch (err) {
          console.error('Error loading group details:', err);
        } finally {
          setLoadingDetails(prev => ({ ...prev, [groupId]: false }));
        }
      } else {
        // Details already loaded, just load work sessions if needed
        const details = groupDetails[groupId];
        if (!groupWorkSessions[groupId] && details.session_ids && details.session_ids.length > 0) {
          setLoadingWorkSessions(prev => ({ ...prev, [groupId]: true }));
          try {
            const result = await invoke('getGroupWorkSessions', { sessionIds: details.session_ids });
            if (result.success) {
              setGroupWorkSessions(prev => ({ ...prev, [groupId]: result.dateGroups || [] }));
            }
          } catch (err) {
            console.error('Error loading work sessions for group:', err);
          } finally {
            setLoadingWorkSessions(prev => ({ ...prev, [groupId]: false }));
          }
        }
      }
    }

    setExpandedGroups(newExpanded);
  };

  const handleAssignClick = async (group, e) => {
    e.stopPropagation();

    // Get the detailed data (with session_ids) - either from cache or fetch
    let details = groupDetails[group.id];

    if (!details) {
      try {
        const detailsResult = await invoke('getGroupDetails', { groupId: group.id });
        if (detailsResult.success) {
          details = detailsResult;
          setGroupDetails(prev => ({ ...prev, [group.id]: detailsResult }));
        } else {
          alert('Failed to load group details: ' + detailsResult.error);
          return;
        }
      } catch (err) {
        alert('Error loading group details: ' + err.message);
        return;
      }
    }

    // Merge group summary with detailed data for assignment
    const groupWithDetails = {
      ...group,
      session_ids: details.session_ids,
      session_count: details.session_count,
      total_seconds: details.total_seconds,
      total_time_formatted: details.total_time_formatted
    };

    onAssignClick(groupWithDetails);
  };

  return (
    <>
      <div className="groups-accordion">
        {groups.map((group, index) => {
          const isExpanded = expandedGroups.has(group.id);
          const dateGroups = groupWorkSessions[group.id] || [];
          const isLoadingWorkSessionsForGroup = loadingWorkSessions[group.id];
          const isLoadingGroupDetails = loadingDetails[group.id];
          const details = groupDetails[group.id];

          return (
            <div key={group.id || index} className={`accordion-item confidence-${group.confidence}`}>
              <div
                className="accordion-header"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="accordion-header-left">
                  <span className={`accordion-toggle ${isExpanded ? 'expanded' : ''}`}>
                    ›
                  </span>
                  <div className="group-title-section">
                    <h3 className="group-label">{group.label || 'Untitled Group'}</h3>
                    {!isExpanded && group.description && (
                      <p className="group-description-preview">{group.description}</p>
                    )}
                  </div>
                </div>
                <div className="accordion-header-right">
                  <div className="stat-compact">
                    <span className="stat-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                      </svg>
                    </span>
                    <span className="stat-value">{details?.session_count || group.session_count}</span>
                  </div>
                  <div className="stat-compact">
                    <span className="stat-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </span>
                    <span className="stat-value">{details?.total_time_formatted || group.total_time_formatted}</span>
                  </div>
                  <button
                    className="assign-button-compact"
                    onClick={(e) => handleAssignClick(group, e)}
                  >
                    Assign
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="accordion-content">
                  <p className="group-description">{group.description}</p>

                  {group.recommendation && (
                    <div className={`group-recommendation recommendation-${group.recommendation.action}`}>
                      <span className={`confidence-badge confidence-${group.confidence}`}>
                        {group.confidence}
                      </span>
                      <div className="recommendation-content">
                        <strong>AI Recommendation:</strong> {group.recommendation.reason}
                        {group.recommendation.suggested_issue_key && (
                          <div className="suggested-issue">
                            Suggested Issue: <strong>{group.recommendation.suggested_issue_key}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Loading state for group details */}
                  {isLoadingGroupDetails && (
                    <div className="loading-details">
                      <span className="spinner"></span>
                      Loading group details...
                    </div>
                  )}

                  {/* Show details when loaded */}
                  {!isLoadingGroupDetails && details && (
                    <>
                      <div className="work-sessions-section">
                        {isLoadingWorkSessionsForGroup && (
                          <div className="loading-sessions">Loading work sessions...</div>
                        )}

                        {!isLoadingWorkSessionsForGroup && dateGroups.length === 0 && (
                          <div className="no-sessions">No work sessions available</div>
                        )}

                        {!isLoadingWorkSessionsForGroup && dateGroups.length > 0 && (
                          <div className="sessions-by-date">
                            {dateGroups.map((dateGroup, dateIdx) => (
                              <div key={dateIdx} className="date-group">
                                <div className="date-header">
                                  <span className="date-label">
                                    {formatDate(dateGroup.date)}
                                  </span>
                                  <span className="date-total">
                                    Total: {formatTime(dateGroup.totalSeconds)}
                                  </span>
                                </div>
                                <div className="sessions-list">
                                  {dateGroup.sessions.map((session, sessionIdx) => {
                                    const sessionDuration = getSessionDuration(session);
                                    return (
                                      <div key={sessionIdx} className="session-item">
                                        <span className="session-time">
                                          {formatTimeOfDay(session.startTime)}
                                          {' → '}
                                          {formatTimeOfDay(session.endTime)}
                                        </span>
                                        <span className="session-duration-icon">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12 6 12 12 16 14"></polyline>
                                          </svg>
                                        </span>
                                        <span className="session-duration">
                                          {formatTime(sessionDuration)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="accordion-actions">
                        <button
                          className="assign-button-full"
                          onClick={(e) => handleAssignClick(group, e)}
                        >
                          Assign This Group
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load More Button for Pagination */}
      {hasMoreGroups && (
        <div className="load-more-container">
          <button
            className="load-more-btn"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <span className="spinner"></span>
                Loading...
              </>
            ) : (
              <>
                Load More Groups ({groups.length} of {totalGroups})
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}

export default GroupAccordion;
