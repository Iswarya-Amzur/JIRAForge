import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './UnassignedWork.css';

function UnassignedWork() {
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentType, setAssignmentType] = useState('existing'); // 'existing' or 'new'
  const [userIssues, setUserIssues] = useState([]);
  const [userProjects, setUserProjects] = useState([]);

  // User role state
  const [userRole, setUserRole] = useState(null);
  const [canTriggerClustering, setCanTriggerClustering] = useState(false);
  const [clusteringMessage, setClusteringMessage] = useState(null);

  // Accordion states
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [groupScreenshots, setGroupScreenshots] = useState({});
  const [loadingScreenshots, setLoadingScreenshots] = useState({});

  // Fullscreen screenshot state
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenGroupId, setFullscreenGroupId] = useState(null);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  // Form states
  const [selectedIssueKey, setSelectedIssueKey] = useState('');
  const [newIssueSummary, setNewIssueSummary] = useState('');
  const [newIssueDescription, setNewIssueDescription] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [issueType, setIssueType] = useState('Task');
  const [assigning, setAssigning] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('To Do');
  const [availableStatuses, setAvailableStatuses] = useState([]);
  const [assignToMe, setAssignToMe] = useState(true);

  // Notification settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);
  const [notificationSettingsMessage, setNotificationSettingsMessage] = useState(null);

  useEffect(() => {
    loadUserRole();
    loadUnassignedWork();
    loadUserIssues();
    loadUserProjects();
    loadNotificationSettings();
  }, []);

  // Load statuses when project changes
  useEffect(() => {
    if (selectedProject) {
      loadProjectStatuses(selectedProject);
    }
  }, [selectedProject]);

  const loadUserRole = async () => {
    console.log('[UnassignedWork] Loading user role...');
    try {
      const result = await invoke('getUserRole');
      console.log('[UnassignedWork] getUserRole result:', result);
      if (result.success) {
        setUserRole(result.role);
        setCanTriggerClustering(result.permissions?.canTriggerClustering || false);
        console.log('[UnassignedWork] Role:', result.role, 'canTriggerClustering:', result.permissions?.canTriggerClustering);
      } else {
        console.log('[UnassignedWork] getUserRole failed:', result.error);
      }
    } catch (err) {
      console.error('[UnassignedWork] Error loading user role:', err);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const result = await invoke('getUnassignedNotificationSettings');
      if (result.success && result.settings) {
        setNotificationsEnabled(result.settings.unassignedWorkNotificationsEnabled ?? true);
      }
    } catch (err) {
      console.error('[UnassignedWork] Error loading notification settings:', err);
    }
  };

  const handleToggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setSavingNotificationSettings(true);
    setNotificationSettingsMessage(null);

    try {
      const result = await invoke('saveUnassignedNotificationSettings', {
        settings: {
          unassignedWorkNotificationsEnabled: newValue
        }
      });

      if (result.success) {
        setNotificationsEnabled(newValue);
        setNotificationSettingsMessage({
          type: 'success',
          text: newValue ? 'Desktop notifications enabled' : 'Desktop notifications disabled'
        });
        // Auto-dismiss after 3 seconds
        setTimeout(() => setNotificationSettingsMessage(null), 3000);
      } else {
        setNotificationSettingsMessage({
          type: 'error',
          text: result.error || 'Failed to save notification settings'
        });
      }
    } catch (err) {
      console.error('[UnassignedWork] Error saving notification settings:', err);
      setNotificationSettingsMessage({
        type: 'error',
        text: err.message || 'Failed to save notification settings'
      });
    } finally {
      setSavingNotificationSettings(false);
    }
  };

  const handleTriggerClustering = async () => {
    if (!canTriggerClustering) return;
    
    setClustering(true);
    setClusteringMessage(null);
    setError(null);

    try {
      const result = await invoke('triggerClustering');
      
      if (result.success) {
        setClusteringMessage({
          type: 'success',
          text: result.message || 'Clustering completed successfully!'
        });
        // Reload the groups after clustering
        await loadUnassignedWork();
      } else {
        setClusteringMessage({
          type: 'error',
          text: result.error || 'Failed to trigger clustering'
        });
      }
    } catch (err) {
      console.error('Error triggering clustering:', err);
      setClusteringMessage({
        type: 'error',
        text: err.message || 'Failed to trigger clustering'
      });
    } finally {
      setClustering(false);
    }
  };

  const loadUnassignedWork = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load pre-clustered groups from database (AI server creates these automatically)
      const groupsResult = await invoke('getUnassignedGroups');

      if (groupsResult.success) {
        // Filter out groups with no valid sessions (data inconsistency)
        const validGroups = (groupsResult.groups || []).filter(g => 
          g.session_ids && Array.isArray(g.session_ids) && g.session_ids.length > 0
        );
        setGroups(validGroups);
        
        if (validGroups.length < (groupsResult.groups || []).length) {
          console.warn(`Filtered out ${(groupsResult.groups || []).length - validGroups.length} groups with no valid sessions`);
        }

        // Also load individual sessions for display purposes
        const sessionsResult = await invoke('getUnassignedWork', { limit: 100 });
        if (sessionsResult.success) {
          setSessions(sessionsResult.sessions || []);
        }
      } else {
        setError(groupsResult.error || 'Failed to load unassigned work');
      }
    } catch (err) {
      console.error('Error loading unassigned work:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserIssues = async () => {
    try {
      const result = await invoke('getAllUserAssignedIssues');
      if (result.success) {
        setUserIssues(result.issues || []);
      }
    } catch (err) {
      console.error('Error loading user issues:', err);
    }
  };

  const loadUserProjects = async () => {
    try {
      const result = await invoke('getUserProjects');
      if (result.success) {
        setUserProjects(result.projects || []);
        if (result.projects?.length > 0) {
          setSelectedProject(result.projects[0].key);
        }
      }
    } catch (err) {
      console.error('Error loading user projects:', err);
    }
  };

  const loadProjectStatuses = async (projectKey) => {
    try {
      const result = await invoke('getProjectStatuses', { projectKey });
      if (result.success) {
        setAvailableStatuses(result.statuses || []);
        // Set default status if available
        if (result.statuses && result.statuses.length > 0) {
          const toDoStatus = result.statuses.find(s => s.name === 'To Do');
          setSelectedStatus(toDoStatus ? 'To Do' : result.statuses[0].name);
        }
      }
    } catch (err) {
      console.error('Error loading project statuses:', err);
      // Set default statuses
      setAvailableStatuses([
        { name: 'To Do', id: '1' },
        { name: 'In Progress', id: '3' },
        { name: 'Done', id: '10001' }
      ]);
    }
  };

  const toggleGroup = async (groupId, sessionIds) => {
    const newExpanded = new Set(expandedGroups);

    if (newExpanded.has(groupId)) {
      // Collapse
      newExpanded.delete(groupId);
    } else {
      // Expand - load screenshots if not already loaded
      newExpanded.add(groupId);

      if (!groupScreenshots[groupId] && sessionIds && sessionIds.length > 0) {
        setLoadingScreenshots(prev => ({ ...prev, [groupId]: true }));
        try {
          console.log('[UnassignedWork] Fetching screenshots for group:', groupId, 'with session IDs:', sessionIds);
          const result = await invoke('getGroupScreenshots', { sessionIds });
          console.log('[UnassignedWork] Screenshot result:', result);
          if (result.success) {
            setGroupScreenshots(prev => ({ ...prev, [groupId]: result.screenshots || [] }));
          } else {
            console.error('[UnassignedWork] Failed to load screenshots:', result.error);
          }
        } catch (err) {
          console.error('Error loading screenshots for group:', err);
        } finally {
          setLoadingScreenshots(prev => ({ ...prev, [groupId]: false }));
        }
      }
    }

    setExpandedGroups(newExpanded);
  };

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

  // NOTE: Clustering is now done automatically by the AI server
  // Groups are fetched directly from database via getUnassignedGroups

  // Fullscreen screenshot handlers
  const openFullscreen = (groupId, index) => {
    setFullscreenGroupId(groupId);
    setFullscreenIndex(index);
    setFullscreenOpen(true);
  };

  const closeFullscreen = () => {
    setFullscreenOpen(false);
    setFullscreenGroupId(null);
    setFullscreenIndex(0);
  };

  const getFullscreenScreenshots = () => {
    if (!fullscreenGroupId || !groupScreenshots[fullscreenGroupId]) return [];
    return groupScreenshots[fullscreenGroupId];
  };

  const nextFullscreenImage = () => {
    const screenshots = getFullscreenScreenshots();
    if (screenshots.length > 0) {
      setFullscreenIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : 0));
    }
  };

  const prevFullscreenImage = () => {
    const screenshots = getFullscreenScreenshots();
    if (screenshots.length > 0) {
      setFullscreenIndex((prev) => (prev > 0 ? prev - 1 : screenshots.length - 1));
    }
  };

  const handleAssignClick = (group) => {
    setSelectedGroup(group);
    setShowAssignModal(true);

    // Pre-fill form with AI suggestions
    if (group.recommendation?.action === 'assign_to_existing' && group.recommendation?.suggested_issue_key) {
      setAssignmentType('existing');
      setSelectedIssueKey(group.recommendation.suggested_issue_key);
    } else if (group.recommendation?.action === 'create_new_issue') {
      setAssignmentType('new');
      setNewIssueSummary(group.label || '');
      setNewIssueDescription(group.description || '');
    }
  };

  const handleAssignToExisting = async () => {
    if (!selectedIssueKey) {
      alert('Please select an issue');
      return;
    }

    // Validate session IDs before proceeding
    if (!selectedGroup.session_ids || !Array.isArray(selectedGroup.session_ids) || selectedGroup.session_ids.length === 0) {
      alert('No sessions available in this group. Please select a different group.');
      return;
    }

    setAssigning(true);
    try {
      const result = await invoke('assignToExistingIssue', {
        sessionIds: selectedGroup.session_ids,
        issueKey: selectedIssueKey,
        groupId: selectedGroup.id, // Use actual UUID from database
        totalSeconds: selectedGroup.total_seconds
      });

      if (result.success) {
        alert(`Successfully assigned ${result.assigned_count} session(s) to ${result.issue_key}`);
        setShowAssignModal(false);
        setSelectedGroup(null);
        // Reload unassigned work
        loadUnassignedWork();
      } else {
        alert('Failed to assign work: ' + result.error);
      }
    } catch (err) {
      console.error('Error assigning work:', err);
      alert('Error assigning work: ' + err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateNewIssue = async () => {
    if (!newIssueSummary) {
      alert('Please enter issue summary');
      return;
    }

    if (!selectedProject) {
      alert('Please select a project');
      return;
    }

    // Validate session IDs before proceeding
    if (!selectedGroup.session_ids || !Array.isArray(selectedGroup.session_ids) || selectedGroup.session_ids.length === 0) {
      alert('No sessions available in this group. Please select a different group.');
      return;
    }

    setAssigning(true);
    try {
      const result = await invoke('createIssueAndAssign', {
        sessionIds: selectedGroup.session_ids,
        issueSummary: newIssueSummary,
        issueDescription: newIssueDescription,
        projectKey: selectedProject,
        issueType: issueType,
        totalSeconds: selectedGroup.total_seconds,
        groupId: selectedGroup.id, // Use actual UUID from database
        assigneeAccountId: assignToMe ? null : null, // null means use current user (default)
        statusName: selectedStatus
      });

      if (result.success) {
        alert(`Successfully created issue ${result.issue_key} and assigned ${result.assigned_count} session(s)`);
        setShowAssignModal(false);
        setSelectedGroup(null);
        // Reload unassigned work
        loadUnassignedWork();
      } else {
        alert('Failed to create issue: ' + result.error);
      }
    } catch (err) {
      console.error('Error creating issue:', err);
      alert('Error creating issue: ' + err.message);
    } finally {
      setAssigning(false);
    }
  };

  // Removed generateGroupId - now using actual group.id from database

  const getTotalTime = () => {
    // Calculate from groups instead of all sessions to match displayed data
    return groups.reduce((sum, g) => sum + (g.total_seconds || 0), 0);
  };

  const getTotalSessions = () => {
    // Count sessions from groups instead of all sessions
    return groups.reduce((sum, g) => sum + (g.session_count || 0), 0);
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  if (loading) {
    return <div className="unassigned-work-container"><div className="loading">Loading unassigned work...</div></div>;
  }

  if (error) {
    return <div className="unassigned-work-container"><div className="error">Error: {error}</div></div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="unassigned-work-container">
        <h2>Unassigned Work</h2>
        <div className="empty-state">
          <p>🎉 Great job! You don't have any unassigned work sessions.</p>
          <p className="empty-subtitle">All your work time has been assigned to Jira issues.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="unassigned-work-container">
      <div className="unassigned-work-header">
        <div className="header-top-row">
          <h2>Unassigned Work</h2>
          {canTriggerClustering && (
            <button 
              className="trigger-clustering-btn"
              onClick={handleTriggerClustering}
              disabled={clustering}
            >
              {clustering ? (
                <>
                  <span className="spinner"></span>
                  Grouping...
                </>
              ) : (
                <>
                  🔄 Group Activities
                </>
              )}
            </button>
          )}
        </div>
        <div className="unassigned-work-summary">
          <span className="summary-item">
            <strong>{getTotalSessions()}</strong> sessions
          </span>
          <span className="summary-divider">•</span>
          <span className="summary-item">
            <strong>{groups.length}</strong> groups
          </span>
          <span className="summary-divider">•</span>
          <span className="summary-item">
            <strong>{formatDuration(getTotalTime())}</strong> total time
          </span>
        </div>

        {/* Desktop Notification Toggle */}
        <div className="notification-settings-row">
          <div className="notification-toggle-container">
            <label className="notification-toggle-label">
              <span className="notification-icon">🔔</span>
              <span className="notification-text">Desktop Notifications</span>
              <div className="toggle-switch-wrapper">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={handleToggleNotifications}
                  disabled={savingNotificationSettings}
                  className="toggle-input"
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
            <span className="notification-hint">
              {notificationsEnabled ? 'You will receive reminders to assign pending work' : 'Reminders are disabled'}
            </span>
          </div>
          {notificationSettingsMessage && (
            <span className={`notification-settings-message ${notificationSettingsMessage.type}`}>
              {notificationSettingsMessage.type === 'success' ? '✓' : '✕'} {notificationSettingsMessage.text}
            </span>
          )}
        </div>
      </div>

      {clusteringMessage && (
        <div className={`clustering-result-message ${clusteringMessage.type}`}>
          {clusteringMessage.type === 'success' ? '✅' : '❌'} {clusteringMessage.text}
          <button 
            className="dismiss-btn"
            onClick={() => setClusteringMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {clustering && (
        <div className="clustering-message">
          AI is grouping your work sessions...
        </div>
      )}

      {groups.length === 0 && !clustering && sessions.length > 0 && (
        <div className="no-groups-message">
          <p>No groups available yet.</p>
          <p>The AI server automatically groups similar sessions every 5 minutes.</p>
          <p>Check back shortly or wait for automatic grouping to complete.</p>
        </div>
      )}

      <div className="groups-accordion">
        {groups.map((group, index) => {
          const isExpanded = expandedGroups.has(group.id);
          const screenshots = groupScreenshots[group.id] || [];
          const isLoadingScreenshots = loadingScreenshots[group.id];

          return (
            <div key={group.id || index} className={`accordion-item confidence-${group.confidence}`}>
              <div
                className="accordion-header"
                onClick={() => toggleGroup(group.id, group.session_ids)}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssignClick(group);
                    }}
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

                  <div className="screenshots-section">
                    <h4 className="screenshots-title">
                      Screenshots ({group.session_count})
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
                              onClick={() => openFullscreen(group.id, idx)}
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
                      onClick={() => handleAssignClick(group)}
                    >
                      Assign This Group
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assignment Modal */}
      {showAssignModal && selectedGroup && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign "{selectedGroup.label}"</h3>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="assignment-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="assignment-type"
                    value="existing"
                    checked={assignmentType === 'existing'}
                    onChange={() => setAssignmentType('existing')}
                  />
                  <span>Add to Existing Issue</span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="assignment-type"
                    value="new"
                    checked={assignmentType === 'new'}
                    onChange={() => setAssignmentType('new')}
                  />
                  <span>Create New Issue</span>
                </label>
              </div>

              {assignmentType === 'existing' && (
                <div className="existing-issue-form">
                  <label>
                    Select Jira Issue:
                    <select
                      value={selectedIssueKey}
                      onChange={(e) => setSelectedIssueKey(e.target.value)}
                    >
                      <option value="">-- Select Issue --</option>
                      {userIssues.map(issue => (
                        <option key={issue.key} value={issue.key}>
                          {issue.key}: {issue.summary}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="time-preview">
                    Time to log: <strong>{selectedGroup.total_time_formatted}</strong>
                  </div>
                  <button
                    className="submit-button"
                    onClick={handleAssignToExisting}
                    disabled={assigning || !selectedIssueKey}
                  >
                    {assigning ? 'Assigning...' : 'Assign to Issue'}
                  </button>
                </div>
              )}

              {assignmentType === 'new' && (
                <div className="new-issue-form">
                  <label>
                    Issue Summary: *
                    <input
                      type="text"
                      value={newIssueSummary}
                      onChange={(e) => setNewIssueSummary(e.target.value)}
                      placeholder="Enter issue title"
                      required
                    />
                  </label>

                  <label>
                    Description:
                    <textarea
                      value={newIssueDescription}
                      onChange={(e) => setNewIssueDescription(e.target.value)}
                      placeholder="Describe the work performed..."
                      rows={4}
                    />
                  </label>

                  <label>
                    Project: *
                    <select
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      required
                    >
                      {userProjects.map(project => (
                        <option key={project.key} value={project.key}>
                          {project.name} ({project.key})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Issue Type:
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                    >
                      <option value="Task">Task</option>
                      <option value="Bug">Bug</option>
                      <option value="Story">Story</option>
                    </select>
                  </label>

                  <label>
                    Status: *
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      required
                    >
                      {availableStatuses.length > 0 ? (
                        availableStatuses.map(status => (
                          <option key={status.id || status.name} value={status.name}>
                            {status.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="To Do">To Do</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Done">Done</option>
                        </>
                      )}
                    </select>
                    <small>Selecting a status prevents the issue from going to backlog</small>
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={assignToMe}
                      onChange={(e) => setAssignToMe(e.target.checked)}
                    />
                    Assign to me (current user)
                  </label>

                  <div className="time-preview">
                    Time to log: <strong>{selectedGroup.total_time_formatted}</strong>
                  </div>

                  <button
                    className="submit-button"
                    onClick={handleCreateNewIssue}
                    disabled={assigning || !newIssueSummary || !selectedProject}
                  >
                    {assigning ? 'Creating...' : 'Create Issue & Log Time'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Screenshot View */}
      {fullscreenOpen && getFullscreenScreenshots().length > 0 && (
        <div className="fullscreen-overlay" onClick={closeFullscreen}>
          <div className="fullscreen-content">
            <button className="fullscreen-close" onClick={closeFullscreen}>
              ✕ Close
            </button>
            <img
              src={getFullscreenScreenshots()[fullscreenIndex]?.signed_thumbnail_url}
              alt={`Screenshot ${fullscreenIndex + 1}`}
              className="fullscreen-image"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="fullscreen-info">
              <span>{getFullscreenScreenshots()[fullscreenIndex]?.application_name || 'Unknown App'}</span>
              <span> | </span>
              <span>{getFullscreenScreenshots()[fullscreenIndex]?.window_title || 'Unknown Window'}</span>
              <span> | </span>
              <span>{getFullscreenScreenshots()[fullscreenIndex]?.timestamp
                ? new Date(getFullscreenScreenshots()[fullscreenIndex].timestamp).toLocaleString()
                : 'Unknown'}</span>
              <span> | </span>
              <span>{fullscreenIndex + 1} of {getFullscreenScreenshots().length}</span>
            </div>
            {getFullscreenScreenshots().length > 1 && (
              <>
                <button
                  className="fullscreen-nav fullscreen-prev"
                  onClick={(e) => { e.stopPropagation(); prevFullscreenImage(); }}
                >
                  ◀
                </button>
                <button
                  className="fullscreen-nav fullscreen-next"
                  onClick={(e) => { e.stopPropagation(); nextFullscreenImage(); }}
                >
                  ▶
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default UnassignedWork;
