import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { AssignmentModal, BulkEditModal, FullscreenViewer, GroupAccordion } from './unassigned';
import './UnassignedWork.css';

function UnassignedWork() {
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userIssues, setUserIssues] = useState([]);
  const [userProjects, setUserProjects] = useState([]);

  // Pagination state for lazy loading
  const [hasMoreGroups, setHasMoreGroups] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalGroups, setTotalGroups] = useState(0);
  const GROUPS_PER_PAGE = 10;

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  // Fullscreen screenshot state
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenScreenshots, setFullscreenScreenshots] = useState([]);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  // Notification settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);
  const [notificationSettingsMessage, setNotificationSettingsMessage] = useState(null);

  useEffect(() => {
    loadUnassignedWork();
    loadUserIssues();
    loadUserProjects();
    loadNotificationSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loadUnassignedWork = async (append = false) => {
    if (!append) {
      setLoading(true);
      setError(null);
    }

    try {
      const offset = append ? nextOffset : 0;
      const groupsResult = await invoke('getUnassignedGroups', {
        limit: GROUPS_PER_PAGE,
        offset
      });

      if (groupsResult.success) {
        const newGroups = groupsResult.groups || [];

        if (append) {
          setGroups(prev => [...prev, ...newGroups]);
        } else {
          setGroups(newGroups);
        }

        setHasMoreGroups(groupsResult.has_more || false);
        setNextOffset(groupsResult.next_offset || 0);
        setTotalGroups(groupsResult.total_groups || 0);

        if (!append) {
          const sessionsResult = await invoke('getUnassignedWork', { limit: 100 });
          if (sessionsResult.success) {
            setSessions(sessionsResult.sessions || []);
          }
        }
      } else {
        setError(groupsResult.error || 'Failed to load unassigned work');
      }
    } catch (err) {
      console.error('Error loading unassigned work:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreGroups = async () => {
    if (loadingMore || !hasMoreGroups) return;
    setLoadingMore(true);
    await loadUnassignedWork(true);
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
      }
    } catch (err) {
      console.error('Error loading user projects:', err);
    }
  };

  // Fullscreen handlers
  const openFullscreen = (groupId, index, screenshots) => {
    setFullscreenScreenshots(screenshots);
    setFullscreenIndex(index);
    setFullscreenOpen(true);
  };

  const closeFullscreen = () => {
    setFullscreenOpen(false);
    setFullscreenScreenshots([]);
    setFullscreenIndex(0);
  };

  const nextFullscreenImage = () => {
    if (fullscreenScreenshots.length > 0) {
      setFullscreenIndex((prev) => (prev < fullscreenScreenshots.length - 1 ? prev + 1 : 0));
    }
  };

  const prevFullscreenImage = () => {
    if (fullscreenScreenshots.length > 0) {
      setFullscreenIndex((prev) => (prev > 0 ? prev - 1 : fullscreenScreenshots.length - 1));
    }
  };

  // Assignment handlers
  const handleAssignClick = (groupWithDetails) => {
    setSelectedGroup(groupWithDetails);
    setShowAssignModal(true);
  };

  const handleAssignmentComplete = () => {
    setSelectedGroup(null);
    loadUnassignedWork();
  };

  // Bulk edit handlers
  const handleBulkEditSuccess = () => {
    loadUnassignedWork();
  };

  // Summary calculations
  const getTotalTime = () => {
    return groups.reduce((sum, g) => sum + (g.total_seconds || 0), 0);
  };

  const getTotalSessions = () => {
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
          <p>Great job! You don't have any unassigned work sessions.</p>
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
          <div className="header-buttons-row">
            <button
              className="bulk-time-edit-btn"
              onClick={() => setShowBulkEditModal(true)}
              title="Bulk reassign activities by time interval"
            >
              <span className="clock-icon">🕐</span>
              Bulk Time Edit
            </button>
          </div>
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

      {groups.length === 0 && sessions.length > 0 && (
        <div className="no-groups-message">
          <p>No groups available yet.</p>
          <p>Groups are created automatically when work sessions are analyzed.</p>
          <p>Check back shortly.</p>
        </div>
      )}

      <GroupAccordion
        groups={groups}
        hasMoreGroups={hasMoreGroups}
        totalGroups={totalGroups}
        loadingMore={loadingMore}
        onLoadMore={loadMoreGroups}
        onAssignClick={handleAssignClick}
        onOpenFullscreen={openFullscreen}
      />

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={showAssignModal}
        selectedGroup={selectedGroup}
        userIssues={userIssues}
        userProjects={userProjects}
        onClose={() => setShowAssignModal(false)}
        onAssignmentComplete={handleAssignmentComplete}
      />

      {/* Fullscreen Screenshot View */}
      <FullscreenViewer
        isOpen={fullscreenOpen}
        screenshots={fullscreenScreenshots}
        currentIndex={fullscreenIndex}
        onClose={closeFullscreen}
        onNext={nextFullscreenImage}
        onPrev={prevFullscreenImage}
      />

      {/* Bulk Time Edit Modal */}
      <BulkEditModal
        isOpen={showBulkEditModal}
        userIssues={userIssues}
        onClose={() => setShowBulkEditModal(false)}
        onSuccess={handleBulkEditSuccess}
      />
    </div>
  );
}

export default UnassignedWork;
