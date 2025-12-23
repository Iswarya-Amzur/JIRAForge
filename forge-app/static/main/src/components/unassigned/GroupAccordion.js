import React, { useState } from 'react';
import { invoke } from '@forge/bridge';
import './GroupAccordion.css';

function GroupAccordion({
  groups,
  hasMoreGroups,
  totalGroups,
  loadingMore,
  onLoadMore,
  onAssignClick,
  onOpenFullscreen
}) {
  // Accordion states
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [groupScreenshots, setGroupScreenshots] = useState({});
  const [loadingScreenshots, setLoadingScreenshots] = useState({});
  const [groupDetails, setGroupDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const toggleGroup = async (groupId) => {
    const newExpanded = new Set(expandedGroups);

    if (newExpanded.has(groupId)) {
      // Collapse
      newExpanded.delete(groupId);
    } else {
      // Expand - load group details and screenshots if not already loaded
      newExpanded.add(groupId);

      // LAZY LOADING: Load group details (session_ids) if not cached
      if (!groupDetails[groupId]) {
        setLoadingDetails(prev => ({ ...prev, [groupId]: true }));
        try {
          const detailsResult = await invoke('getGroupDetails', { groupId });

          if (detailsResult.success) {
            setGroupDetails(prev => ({ ...prev, [groupId]: detailsResult }));

            // Now load screenshots using the session_ids from details
            if (detailsResult.session_ids && detailsResult.session_ids.length > 0) {
              setLoadingScreenshots(prev => ({ ...prev, [groupId]: true }));
              try {
                const screenshotsResult = await invoke('getGroupScreenshots', {
                  sessionIds: detailsResult.session_ids
                });
                if (screenshotsResult.success) {
                  setGroupScreenshots(prev => ({
                    ...prev,
                    [groupId]: screenshotsResult.screenshots || []
                  }));
                }
              } catch (err) {
                console.error('Error loading screenshots for group:', err);
              } finally {
                setLoadingScreenshots(prev => ({ ...prev, [groupId]: false }));
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
        // Details already loaded, just load screenshots if needed
        const details = groupDetails[groupId];
        if (!groupScreenshots[groupId] && details.session_ids && details.session_ids.length > 0) {
          setLoadingScreenshots(prev => ({ ...prev, [groupId]: true }));
          try {
            const result = await invoke('getGroupScreenshots', { sessionIds: details.session_ids });
            if (result.success) {
              setGroupScreenshots(prev => ({ ...prev, [groupId]: result.screenshots || [] }));
            }
          } catch (err) {
            console.error('Error loading screenshots for group:', err);
          } finally {
            setLoadingScreenshots(prev => ({ ...prev, [groupId]: false }));
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
          const screenshots = groupScreenshots[group.id] || [];
          const isLoadingScreenshots = loadingScreenshots[group.id];
          const isLoadingGroupDetails = loadingDetails[group.id];
          const details = groupDetails[group.id];

          return (
            <div key={group.id || index} className={`accordion-item confidence-${group.confidence}`}>
              <div
                className="accordion-header"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="accordion-header-left">
                  <span className="accordion-toggle">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <div className="group-title-section">
                    <h3 className="group-label">{group.label || 'Untitled Group'}</h3>
                    {!isExpanded && group.description && (
                      <p className="group-description-preview">{group.description}</p>
                    )}
                  </div>
                  <span className={`confidence-badge confidence-${group.confidence}`}>
                    {group.confidence}
                  </span>
                </div>
                <div className="accordion-header-right">
                  <div className="stat-compact">
                    <span className="stat-icon">📸</span>
                    <span className="stat-value">{group.session_count}</span>
                  </div>
                  <div className="stat-compact">
                    <span className="stat-icon">⏱️</span>
                    <span className="stat-value">{group.total_time_formatted}</span>
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
                      <strong>AI Recommendation:</strong> {group.recommendation.reason}
                      {group.recommendation.suggested_issue_key && (
                        <div className="suggested-issue">
                          Suggested Issue: <strong>{group.recommendation.suggested_issue_key}</strong>
                        </div>
                      )}
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
                      {/* Updated session count from details */}
                      <div className="group-details-summary">
                        <span>📸 {details.session_count} sessions</span>
                        <span className="summary-divider">•</span>
                        <span>⏱️ {details.total_time_formatted}</span>
                      </div>

                      <div className="screenshots-section">
                        <h4 className="screenshots-title">
                          Screenshots ({details.session_count})
                        </h4>

                        {isLoadingScreenshots && (
                          <div className="loading-screenshots">Loading screenshots...</div>
                        )}

                        {!isLoadingScreenshots && screenshots.length === 0 && (
                          <div className="no-screenshots">No screenshots available</div>
                        )}

                        {!isLoadingScreenshots && screenshots.length > 0 && (
                          <div className="screenshots-grid">
                            {screenshots.map((screenshot, idx) => (
                              <div key={screenshot.id || idx} className="screenshot-card">
                                <div
                                  className="screenshot-thumbnail clickable"
                                  onClick={() => onOpenFullscreen(group.id, idx, screenshots)}
                                  title="Click to expand"
                                >
                                  {screenshot.signed_thumbnail_url ? (
                                    <img
                                      src={screenshot.signed_thumbnail_url}
                                      alt={`Screenshot ${idx + 1}`}
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="screenshot-placeholder">
                                      📷 No preview
                                    </div>
                                  )}
                                  <div className="expand-icon">🔍</div>
                                </div>
                                <div className="screenshot-info">
                                  <div className="screenshot-time">
                                    {formatTimestamp(screenshot.timestamp)}
                                  </div>
                                  <div className="screenshot-details">
                                    <div className="screenshot-app" title={screenshot.application_name}>
                                      {screenshot.application_name || 'Unknown'}
                                    </div>
                                    <div className="screenshot-window" title={screenshot.window_title}>
                                      {screenshot.window_title || 'No title'}
                                    </div>
                                  </div>
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
