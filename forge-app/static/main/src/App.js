import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

// Status Dropdown Component
function StatusDropdown({ issue, onStatusChange, isUpdating, onLoadTransitions }) {
  const [isOpen, setIsOpen] = useState(false);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (isUpdating) return;

    if (!isOpen && transitions.length === 0) {
      setLoading(true);
      const trans = await onLoadTransitions(issue.key);
      setTransitions(trans);
      setLoading(false);
    }
    setIsOpen(!isOpen);
  };

  const handleTransitionSelect = (e, transitionId) => {
    e.stopPropagation();
    setIsOpen(false);
    onStatusChange(issue.key, transitionId);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="status-dropdown-container" onClick={(e) => e.stopPropagation()}>
      <button
        className={`status-dropdown-button status-badge status-${issue.statusCategory}`}
        onClick={handleClick}
        disabled={isUpdating}
      >
        {isUpdating ? '...' : issue.status}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="status-dropdown-menu">
          {loading ? (
            <div className="dropdown-loading">Loading...</div>
          ) : transitions.length === 0 ? (
            <div className="dropdown-empty">No transitions available</div>
          ) : (
            transitions.map((transition) => (
              <button
                key={transition.id}
                className={`dropdown-item status-${transition.to.statusCategory}`}
                onClick={(e) => handleTransitionSelect(e, transition.id)}
                disabled={isUpdating}
              >
                {transition.to.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timesheetView, setTimesheetView] = useState('day'); // day, week, month
  const [timeData, setTimeData] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // User Permissions State
  const [userPermissions, setUserPermissions] = useState({
    isJiraAdmin: false,
    projectAdminProjects: [],
    canCreateIssues: false,
    canEditIssues: false
  });

  // Team Analytics State (for Project Admins)
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [teamAnalytics, setTeamAnalytics] = useState(null);

  // Organization Analytics State (for Jira Admins)
  const [orgAnalytics, setOrgAnalytics] = useState(null);

  // Active Issues State (for My Focus widget)
  const [activeIssues, setActiveIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issueFilter, setIssueFilter] = useState('all'); // all, in-progress, done

  // Status Update State
  const [statusUpdating, setStatusUpdating] = useState(null); // Issue key being updated
  const [issueTransitions, setIssueTransitions] = useState({}); // Cache of transitions by issue key

  // BRD Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [currentDocument, setCurrentDocument] = useState(null);
  const [projectKey, setProjectKey] = useState('');

  // Load user permissions on mount
  useEffect(() => {
    loadUserPermissions();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadActiveIssues();
    } else if (activeTab === 'time-analytics') {
      loadTimeAnalytics();
    } else if (activeTab === 'screenshots') {
      loadScreenshots();
    } else if (activeTab === 'team-analytics' && selectedProjectKey) {
      loadTeamAnalytics();
    } else if (activeTab === 'org-analytics') {
      loadOrgAnalytics();
    }
  }, [activeTab, selectedProjectKey]);

  const loadUserPermissions = async () => {
    try {
      const result = await invoke('getUserPermissions');
      if (result.success) {
        setUserPermissions(result.permissions);
        // Set default project for team analytics if user is project admin
        if (result.permissions.projectAdminProjects?.length > 0) {
          setSelectedProjectKey(result.permissions.projectAdminProjects[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  };

  const loadTimeAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getTimeAnalytics');
      if (result.success) {
        setTimeData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load time analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamAnalytics = async () => {
    if (!selectedProjectKey) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getProjectTeamAnalytics', { projectKey: selectedProjectKey });
      if (result.success) {
        setTeamAnalytics(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load team analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getAllAnalytics');
      if (result.success) {
        setOrgAnalytics(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load organization analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveIssues = async () => {
    setIssuesLoading(true);
    try {
      console.log('[MY FOCUS] Calling getActiveIssuesWithTime...');
      const result = await invoke('getActiveIssuesWithTime');
      console.log('[MY FOCUS] Result:', result);
      console.log('[MY FOCUS] Issues count:', result.issues?.length || 0);
      if (result.success) {
        setActiveIssues(result.issues || []);
        console.log('[MY FOCUS] Active issues set:', result.issues);
      } else {
        console.error('[MY FOCUS] Failed to load active issues:', result.error);
        setActiveIssues([]);
      }
    } catch (err) {
      console.error('[MY FOCUS] Exception while loading active issues:', err);
      setActiveIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  };

  const loadTransitionsForIssue = async (issueKey) => {
    // Check cache first
    if (issueTransitions[issueKey]) {
      return issueTransitions[issueKey];
    }

    try {
      const result = await invoke('getIssueTransitions', { issueKey });
      if (result.success) {
        setIssueTransitions(prev => ({
          ...prev,
          [issueKey]: result.transitions
        }));
        return result.transitions;
      }
      return [];
    } catch (err) {
      console.error(`Failed to load transitions for ${issueKey}:`, err);
      return [];
    }
  };

  const handleStatusChange = async (issueKey, transitionId) => {
    setStatusUpdating(issueKey);
    try {
      const result = await invoke('updateIssueStatus', { issueKey, transitionId });
      if (result.success) {
        // Refresh issues list to show updated status
        await loadActiveIssues();
      } else {
        alert(`Failed to update status: ${result.error}`);
      }
    } catch (err) {
      console.error(`Error updating status for ${issueKey}:`, err);
      alert(`Error updating status: ${err.message}`);
    } finally {
      setStatusUpdating(null);
    }
  };

  const loadScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getScreenshots');
      if (result.success) {
        setScreenshots(result.data.screenshots);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load screenshots: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScreenshot = async (screenshotId) => {
    try {
      const result = await invoke('deleteScreenshot', { screenshotId });
      if (result.success) {
        loadScreenshots(); // Reload the list
      } else {
        alert('Failed to delete screenshot: ' + result.error);
      }
    } catch (err) {
      alert('Error deleting screenshot: ' + err.message);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'application/pdf' ||
                 file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      setSelectedFile(file);
    } else {
      alert('Please select a PDF or DOCX file');
    }
  };

  const pollBRDStatus = async (documentId) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (5 second intervals)
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setProcessingStatus('Processing is taking longer than expected. Please check back later.');
        return;
      }

      try {
        const result = await invoke('getBRDStatus', { documentId });
        if (result.success && result.document) {
          setCurrentDocument(result.document);
          const status = result.document.processing_status;
          
          if (status === 'completed') {
            setProcessingStatus('Document processed successfully! You can now create Jira issues.');
          } else if (status === 'failed') {
            setProcessingStatus(`Processing failed: ${result.document.error_message || 'Unknown error'}`);
          } else {
            setProcessingStatus(`Processing status: ${status}...`);
            attempts++;
            setTimeout(poll, 5000); // Poll every 5 seconds
          }
        }
      } catch (err) {
        console.error('Error polling BRD status:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        }
      }
    };

    setTimeout(poll, 2000); // Start polling after 2 seconds
  };

  const handleCreateIssues = async () => {
    if (!currentDocument || !projectKey) {
      alert('Please enter a project key');
      return;
    }

    setProcessingStatus('Creating Jira issues...');
    try {
      const result = await invoke('createIssuesFromBRD', {
        documentId: currentDocument.id,
        projectKey: projectKey.trim().toUpperCase()
      });

      if (result.success) {
        setProcessingStatus(result.message || 'Issues created successfully!');
        // Refresh document status to show created issues
        const statusResult = await invoke('getBRDStatus', { documentId: currentDocument.id });
        if (statusResult.success) {
          setCurrentDocument(statusResult.document);
        }
      } else {
        setProcessingStatus('Error creating issues: ' + result.error);
      }
    } catch (err) {
      setProcessingStatus('Error creating issues: ' + err.message);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleBRDUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setUploadProgress(10);
    setProcessingStatus('Uploading document...');

    try {
      // Convert file to base64 for transfer
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];

        setUploadProgress(50);
        setProcessingStatus('Processing document...');

        const result = await invoke('uploadBRD', {
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileData: base64Data,
          fileSize: selectedFile.size
        });

        if (result.success) {
          setUploadProgress(100);
          setProcessingStatus('Document uploaded successfully! Processing will begin shortly.');
          setCurrentDocument({ id: result.documentId, status: 'uploaded' });
          setSelectedFile(null);
          // Start polling for status updates
          pollBRDStatus(result.documentId);
        } else {
          setProcessingStatus('Error: ' + result.error);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setProcessingStatus('Error uploading document: ' + err.message);
    }
  };

  return (
    <div className="App">
      <div className="App-layout">
        <aside className="App-sidebar">
          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="sidebar-icon">📊</span>
              <span className="sidebar-label">Dashboard</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'time-analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('time-analytics')}
            >
              <span className="sidebar-icon">📈</span>
              <span className="sidebar-label">Time Analytics</span>
            </button>
            <button
              className={`sidebar-item ${activeTab === 'screenshots' ? 'active' : ''}`}
              onClick={() => setActiveTab('screenshots')}
            >
              <span className="sidebar-icon">🖼️</span>
              <span className="sidebar-label">My Screenshots</span>
            </button>
            {userPermissions.projectAdminProjects?.length > 0 && (
              <button
                className={`sidebar-item ${activeTab === 'team-analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('team-analytics')}
              >
                <span className="sidebar-icon">👥</span>
                <span className="sidebar-label">Team Analytics</span>
              </button>
            )}
            {userPermissions.isJiraAdmin && (
              <button
                className={`sidebar-item ${activeTab === 'org-analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('org-analytics')}
              >
                <span className="sidebar-icon">🏢</span>
                <span className="sidebar-label">Organization Analytics</span>
              </button>
            )}
            <button
              className={`sidebar-item ${activeTab === 'brd-upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('brd-upload')}
            >
              <span className="sidebar-icon">📄</span>
              <span className="sidebar-label">BRD Upload</span>
            </button>
          </nav>
        </aside>

        <main className="App-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <h2>Dashboard</h2>

            {/* My Focus Widget - Active Issues with Time Tracking */}
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
                  {activeIssues.filter(issue => {
                    if (issueFilter === 'all') return true;
                    if (issueFilter === 'in-progress') return issue.statusCategory === 'indeterminate';
                    if (issueFilter === 'done') return issue.statusCategory === 'done';
                    return true;
                  }).length > 0 ? (
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
                          {activeIssues
                            .filter(issue => {
                              if (issueFilter === 'all') return true;
                              if (issueFilter === 'in-progress') return issue.statusCategory === 'indeterminate';
                              if (issueFilter === 'done') return issue.statusCategory === 'done';
                              return true;
                            })
                            .map((issue, idx) => (
                              <React.Fragment key={idx}>
                                <tr className={issue.sessions && issue.sessions.length > 0 ? 'expandable-row' : ''}>
                                  <td className="issue-key">
                                    {issue.sessions && issue.sessions.length > 0 && (
                                      <button
                                        className="expand-button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const row = e.target.closest('tr');
                                          const detailsRow = row.nextElementSibling;
                                          if (detailsRow && detailsRow.classList.contains('details-row')) {
                                            detailsRow.classList.toggle('show');
                                            e.target.textContent = detailsRow.classList.contains('show') ? '▼' : '▶';
                                          }
                                        }}
                                      >
                                        ▶
                                      </button>
                                    )}
                                    <a href={`/browse/${issue.key}`} target="_blank" rel="noopener noreferrer">
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
                                {issue.sessions && issue.sessions.length > 0 && (
                                  <tr className="details-row">
                                    <td colSpan="5">
                                      <div className="session-details">
                                        <h4>Work Sessions ({issue.sessions.length})</h4>
                                        <div className="sessions-by-date">
                                          {(() => {
                                            // Group sessions by date
                                            const sessionsByDate = issue.sessions.reduce((acc, session) => {
                                              const dateKey = session.date;
                                              if (!acc[dateKey]) {
                                                acc[dateKey] = [];
                                              }
                                              acc[dateKey].push(session);
                                              return acc;
                                            }, {});

                                            // Render grouped sessions
                                            return Object.keys(sessionsByDate).sort((a, b) => new Date(b) - new Date(a)).map((dateKey, dateIdx) => {
                                              const dateSessions = sessionsByDate[dateKey];
                                              const displayDate = new Date(dateKey);
                                              const totalDuration = dateSessions.reduce((sum, s) => sum + s.duration, 0);

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
                                                      return (
                                                        <div key={sessionIdx} className="session-item">
                                                          <span className="session-time">
                                                            {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            {' → '}
                                                            {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                          </span>
                                                          <span className="session-duration">
                                                            {formatTime(session.duration)}
                                                          </span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                            });
                                          })()}
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
                    <p className="empty-state">No {issueFilter !== 'all' ? issueFilter.replace('-', ' ') : ''} issues found. Start working on issues to see them here!</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'time-analytics' && (
          <div className="time-analytics">
            <h2>Time Analytics Dashboard</h2>

            {/* Summary Cards */}
            <div className="analytics-summary-cards">
              <div className="analytics-card cumulative-card">
                <h3>Today's Total</h3>
                {loading ? (
                  <p>Loading...</p>
                ) : (
                  <div className="cumulative-stat">
                    <div className="stat-value">
                      {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const totalSeconds = timeData?.dailySummary?.filter(day =>
                          day.work_date?.startsWith(today)
                        ).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
                        return formatTime(totalSeconds);
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="analytics-card cumulative-card">
                <h3>This Week's Total</h3>
                {loading ? (
                  <p>Loading...</p>
                ) : (
                  <div className="cumulative-stat">
                    <div className="stat-value">
                      {(() => {
                        const today = new Date();
                        const startOfWeek = new Date(today);
                        startOfWeek.setDate(today.getDate() - today.getDay());
                        const startStr = startOfWeek.toISOString().split('T')[0];

                        // Use dailySummary and filter for all days in current week
                        const totalSeconds = timeData?.dailySummary?.filter(day =>
                          day.work_date >= startStr
                        ).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
                        return formatTime(totalSeconds);
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div className="analytics-card cumulative-card">
                <h3>This Month's Total</h3>
                {loading ? (
                  <p>Loading...</p>
                ) : (
                  <div className="cumulative-stat">
                    <div className="stat-value">
                      {(() => {
                        const today = new Date();
                        const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

                        // Use dailySummary and filter for all days in current month
                        const totalSeconds = timeData?.dailySummary?.filter(day =>
                          day.work_date?.startsWith(currentMonth)
                        ).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
                        return formatTime(totalSeconds);
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timesheet View Tabs */}
            <div className="timesheet-tabs">
              <button
                className={`timesheet-tab ${timesheetView === 'day' ? 'active' : ''}`}
                onClick={() => setTimesheetView('day')}
              >
                Day
              </button>
              <button
                className={`timesheet-tab ${timesheetView === 'week' ? 'active' : ''}`}
                onClick={() => setTimesheetView('week')}
              >
                Week
              </button>
              <button
                className={`timesheet-tab ${timesheetView === 'month' ? 'active' : ''}`}
                onClick={() => setTimesheetView('month')}
              >
                Month
              </button>
            </div>

            {/* Timesheet Content */}
            <div className="timesheet-content">
              {timesheetView === 'day' && (
                <div className="timesheet-day-view">
                  <div className="timesheet-header">
                    <h3>{timeData?.canViewAllUsers ? 'Daily Timesheet' : 'My Daily Timesheet'} - {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                  </div>

                  {loading ? (
                    <p>Loading...</p>
                  ) : (
                    <div className="team-members-list">
                      {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const todayData = timeData?.dailySummary?.filter(day =>
                          day.work_date?.startsWith(today)
                        ) || [];

                        // Initialize all users with 0 time
                        const tasksByUser = {};

                        // First, add all active users
                        timeData?.allUsers?.forEach(user => {
                          tasksByUser[user.id] = {
                            userId: user.id,
                            displayName: user.display_name || user.email || 'User',
                            tasks: [],
                            totalSeconds: 0
                          };
                        });

                        // Then, populate tasks for users who have tracked time today
                        todayData.forEach(item => {
                          const userId = item.user_id || 'current_user';
                          if (!tasksByUser[userId]) {
                            // User exists in time data but not in allUsers list
                            tasksByUser[userId] = {
                              userId,
                              displayName: item.user_display_name || 'User',
                              tasks: [],
                              totalSeconds: 0
                            };
                          }
                          tasksByUser[userId].tasks.push(item);
                          tasksByUser[userId].totalSeconds += item.total_seconds || 0;
                        });

                        const users = Object.values(tasksByUser).sort((a, b) => b.totalSeconds - a.totalSeconds);

                        if (users.length === 0) {
                          return <p className="empty-state">No users found</p>;
                        }

                        return users.map((user, idx) => (
                          <div key={idx} className="team-member-card">
                            <div className="member-header">
                              <div className="member-avatar">
                                {(user.displayName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="member-info">
                                <span className="member-name">{user.displayName}</span>
                                <span className="member-total">{formatTime(user.totalSeconds)}</span>
                              </div>
                            </div>
                            {user.tasks.length > 0 && (
                              <div className="member-tasks">
                                {user.tasks.map((task, taskIdx) => (
                                  <div key={taskIdx} className="task-item">
                                    <span className="task-key">{task.active_task_key || 'No Task'}</span>
                                    <span className="task-time">{formatTime(task.total_seconds)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}

              {timesheetView === 'week' && (
                <div className="timesheet-week-view">
                  <div className="timesheet-header">
                    <h3>{timeData?.canViewAllUsers ? 'Weekly Timesheet' : 'My Weekly Timesheet'} - Week of {(() => {
                      const today = new Date();
                      const startOfWeek = new Date(today);
                      startOfWeek.setDate(today.getDate() - today.getDay());
                      return startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    })()}</h3>
                  </div>

                  {loading ? (
                    <p>Loading...</p>
                  ) : (
                    <div className="week-table-container">
                      <table className="week-table">
                        <thead>
                          <tr>
                            <th>{timeData?.canViewAllUsers ? 'Team Member' : 'User'}</th>
                            <th>Mon</th>
                            <th>Tue</th>
                            <th>Wed</th>
                            <th>Thu</th>
                            <th>Fri</th>
                            <th>Sat</th>
                            <th>Sun</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Get current week date range
                            const today = new Date();
                            const startOfWeek = new Date(today);
                            startOfWeek.setDate(today.getDate() - today.getDay());

                            // Create array of this week's dates
                            const weekDates = Array.from({ length: 7 }, (_, i) => {
                              const date = new Date(startOfWeek);
                              date.setDate(startOfWeek.getDate() + i);
                              return date.toISOString().split('T')[0];
                            });

                            // Initialize all users with 0 time
                            const userTimeByDay = {};

                            // First, add all active users with 0 time
                            timeData?.allUsers?.forEach(user => {
                              userTimeByDay[user.id] = {
                                userId: user.id,
                                name: user.display_name || user.email || 'User',
                                days: Array(7).fill(0),
                                total: 0
                              };
                            });

                            // Then, populate time data for users who have tracked time
                            timeData?.dailySummary?.forEach(day => {
                              if (weekDates.includes(day.work_date)) {
                                const userId = day.user_id || 'current_user';
                                if (!userTimeByDay[userId]) {
                                  // User exists in time data but not in allUsers list (shouldn't happen)
                                  userTimeByDay[userId] = {
                                    userId,
                                    name: day.user_display_name || 'User',
                                    days: Array(7).fill(0),
                                    total: 0
                                  };
                                }
                                const dayIndex = weekDates.indexOf(day.work_date);
                                userTimeByDay[userId].days[dayIndex] += day.total_seconds || 0;
                                userTimeByDay[userId].total += day.total_seconds || 0;
                              }
                            });

                            const users = Object.values(userTimeByDay).sort((a, b) => b.total - a.total);

                            if (users.length === 0) {
                              return (
                                <tr>
                                  <td colSpan="9" className="empty-state">No users found</td>
                                </tr>
                              );
                            }

                            return (
                              <>
                                {users.map((user, idx) => (
                                  <tr key={idx}>
                                    <td className="member-name-cell">
                                      <div className="member-avatar-small">
                                        {user.name.charAt(0)}
                                      </div>
                                      {user.name}
                                    </td>
                                    {user.days.map((seconds, dayIdx) => (
                                      <td key={dayIdx} className="time-cell">
                                        {seconds > 0 ? formatTime(seconds) : '-'}
                                      </td>
                                    ))}
                                    <td className="total-cell">{formatTime(user.total)}</td>
                                  </tr>
                                ))}
                                {timeData?.canViewAllUsers && users.length > 1 && (
                                  <tr className="totals-row">
                                    <td><strong>Daily Totals</strong></td>
                                    {Array.from({ length: 7 }, (_, dayIdx) => {
                                      const dayTotal = users.reduce((sum, user) => sum + user.days[dayIdx], 0);
                                      return (
                                        <td key={dayIdx} className="total-cell">
                                          {dayTotal > 0 ? formatTime(dayTotal) : '-'}
                                        </td>
                                      );
                                    })}
                                    <td className="grand-total-cell">
                                      {formatTime(users.reduce((sum, user) => sum + user.total, 0))}
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {timesheetView === 'month' && (
                <div className="timesheet-month-view">
                  <div className="timesheet-header">
                    <h3>{timeData?.canViewAllUsers ? 'Monthly Timesheet' : 'My Monthly Timesheet'} - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                  </div>

                  {loading ? (
                    <p>Loading...</p>
                  ) : (
                    <div className="month-layout">
                      <div className="month-calendar">
                        <div className="calendar-grid">
                          <div className="calendar-header">
                            <div className="day-name">Sun</div>
                            <div className="day-name">Mon</div>
                            <div className="day-name">Tue</div>
                            <div className="day-name">Wed</div>
                            <div className="day-name">Thu</div>
                            <div className="day-name">Fri</div>
                            <div className="day-name">Sat</div>
                          </div>
                          <div className="calendar-days">
                            {(() => {
                              const today = new Date();
                              const year = today.getFullYear();
                              const month = today.getMonth();
                              const firstDay = new Date(year, month, 1).getDay();
                              const daysInMonth = new Date(year, month + 1, 0).getDate();

                              // Create time map by date
                              const timeByDate = {};
                              timeData?.dailySummary?.forEach(day => {
                                const date = new Date(day.work_date);
                                if (date.getMonth() === month && date.getFullYear() === year) {
                                  const dayNum = date.getDate();
                                  timeByDate[dayNum] = (timeByDate[dayNum] || 0) + (day.total_seconds || 0);
                                }
                              });

                              const cells = [];

                              // Empty cells before first day
                              for (let i = 0; i < firstDay; i++) {
                                cells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
                              }

                              // Days of the month
                              for (let day = 1; day <= daysInMonth; day++) {
                                const isToday = day === today.getDate();
                                const timeTracked = timeByDate[day] || 0;

                                cells.push(
                                  <div key={day} className={`calendar-day ${isToday ? 'today' : ''} ${timeTracked > 0 ? 'has-time' : ''}`}>
                                    <div className="day-number">{day}</div>
                                    {timeTracked > 0 && (
                                      <div className="day-time">{formatTime(timeTracked)}</div>
                                    )}
                                  </div>
                                );
                              }

                              return cells;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Team Summary - Only visible to Admins and Project Admins */}
                      {(userPermissions.isJiraAdmin || userPermissions.projectAdminProjects?.length > 0) && (
                        <div className="team-summary">
                          <h4>Team Summary</h4>
                        <div className="team-summary-list">
                          {(() => {
                            const today = new Date();
                            const currentMonth = today.toISOString().slice(0, 7);

                            // Initialize all users with 0 time
                            const userMonthlyTime = {};

                            // First, add all active users
                            timeData?.allUsers?.forEach(user => {
                              userMonthlyTime[user.id] = {
                                userId: user.id,
                                name: user.display_name || user.email || 'User',
                                seconds: 0
                              };
                            });

                            // Then, populate time data for users who have tracked time this month
                            timeData?.dailySummary?.forEach(day => {
                              if (day.work_date?.startsWith(currentMonth)) {
                                const userId = day.user_id || 'current_user';
                                if (!userMonthlyTime[userId]) {
                                  // User exists in time data but not in allUsers list
                                  userMonthlyTime[userId] = {
                                    userId,
                                    name: day.user_display_name || 'User',
                                    seconds: 0
                                  };
                                }
                                userMonthlyTime[userId].seconds += day.total_seconds || 0;
                              }
                            });

                            const totalSeconds = Object.values(userMonthlyTime).reduce((sum, u) => sum + u.seconds, 0);
                            const users = Object.values(userMonthlyTime)
                              .map(user => ({
                                userId: user.userId,
                                name: user.name,
                                seconds: user.seconds,
                                percentage: totalSeconds > 0 ? Math.round((user.seconds / totalSeconds) * 100) : 0
                              }))
                              .sort((a, b) => b.seconds - a.seconds);

                            if (users.length === 0) {
                              return <p className="empty-state">No users found</p>;
                            }

                            return users.map((user, idx) => (
                              <div key={idx} className="team-summary-item">
                                <div className="summary-member">
                                  <div className="member-avatar-small">
                                    {user.name.charAt(0)}
                                  </div>
                                  <div className="summary-info">
                                    <div className="summary-name">{user.name}</div>
                                    <div className="summary-time">{formatTime(user.seconds)}</div>
                                  </div>
                                </div>
                                <div className="summary-percentage">{user.percentage}%</div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'screenshots' && (
          <div className="screenshot-gallery">
            <h2>Screenshot Gallery</h2>
            {loading ? (
              <p>Loading screenshots...</p>
            ) : error ? (
              <p className="error">Error: {error}</p>
            ) : screenshots.length === 0 ? (
              <p>No screenshots captured yet. Install the desktop app to start tracking.</p>
            ) : (
              <div className="screenshot-gallery-content">
                <p className="screenshot-count">Total: {screenshots.length} screenshots</p>
                <div className="screenshot-grid">
                  {screenshots.map(screenshot => (
                    <div key={screenshot.id} className="screenshot-item">
                      {(screenshot.signed_thumbnail_url || screenshot.thumbnail_url) ? (
                        <img 
                          src={screenshot.signed_thumbnail_url || screenshot.thumbnail_url} 
                          alt={screenshot.window_title || 'Screenshot'} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <div className="screenshot-placeholder" style={{ display: (screenshot.signed_thumbnail_url || screenshot.thumbnail_url) ? 'none' : 'block' }}>
                        No Preview
                      </div>
                      <div className="screenshot-info">
                        <p className="window-title" title={screenshot.window_title}>
                          {screenshot.window_title || 'Unknown Window'}
                        </p>
                        <p className="app-name">{screenshot.application_name || 'Unknown App'}</p>
                        <p className="timestamp">{new Date(screenshot.timestamp).toLocaleString()}</p>
                        <p className="status">Status: {screenshot.status || 'pending'}</p>
                        <button 
                          className="delete-btn"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this screenshot?')) {
                              handleDeleteScreenshot(screenshot.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'team-analytics' && (
          <div className="team-analytics">
            <h2>Team Analytics Dashboard</h2>
            <div className="project-selector">
              <label htmlFor="team-project-select">Select Project: </label>
              <select
                id="team-project-select"
                value={selectedProjectKey}
                onChange={(e) => setSelectedProjectKey(e.target.value)}
              >
                {userPermissions.projectAdminProjects?.map(pk => (
                  <option key={pk} value={pk}>{pk}</option>
                ))}
              </select>
            </div>
            {loading ? (
              <p>Loading team analytics...</p>
            ) : error ? (
              <p className="error">Error: {error}</p>
            ) : (
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>Team Daily Summary (Last 30 Days)</h3>
                  {teamAnalytics?.teamDailySummary && teamAnalytics.teamDailySummary.length > 0 ? (
                    <div className="data-list">
                      {teamAnalytics.teamDailySummary.slice(0, 10).map((day, idx) => (
                        <div key={idx} className="data-item">
                          <span className="label">{new Date(day.work_date).toLocaleDateString()}</span>
                          <span className="value">
                            {day.active_task_key || 'No task'} - {formatTime(day.total_seconds)}
                          </span>
                        </div>
                      ))}
                      {teamAnalytics.teamDailySummary.length > 10 && (
                        <p className="more-data">+ {teamAnalytics.teamDailySummary.length - 10} more days</p>
                      )}
                    </div>
                  ) : (
                    <p>No team data available yet.</p>
                  )}
                </div>
                <div className="analytics-card">
                  <h3>Team Time by Issue</h3>
                  {teamAnalytics?.teamTimeByIssue && teamAnalytics.teamTimeByIssue.length > 0 ? (
                    <div className="data-list">
                      {teamAnalytics.teamTimeByIssue.map((issue, idx) => (
                        <div key={idx} className="data-item">
                          <span className="label">
                            <a href={`/browse/${issue.issueKey}`} target="_blank" rel="noopener noreferrer">
                              {issue.issueKey}
                            </a>
                            <span className="contributors"> ({issue.contributors} contributor{issue.contributors !== 1 ? 's' : ''})</span>
                          </span>
                          <span className="value">{formatTime(issue.totalSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No team issue data available yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'org-analytics' && (
          <div className="org-analytics">
            <h2>Organization Analytics Dashboard</h2>
            <p className="admin-notice">Jira Administrator View - Global Analytics</p>
            {loading ? (
              <p>Loading organization analytics...</p>
            ) : error ? (
              <p className="error">Error: {error}</p>
            ) : (
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>Organization Daily Summary (Last 30 Days)</h3>
                  {orgAnalytics?.dailySummary && orgAnalytics.dailySummary.length > 0 ? (
                    <div className="data-list">
                      {orgAnalytics.dailySummary.slice(0, 10).map((day, idx) => (
                        <div key={idx} className="data-item">
                          <span className="label">{new Date(day.work_date).toLocaleDateString()}</span>
                          <span className="value">
                            {day.active_task_key || 'No task'} - {formatTime(day.total_seconds)}
                          </span>
                        </div>
                      ))}
                      {orgAnalytics.dailySummary.length > 10 && (
                        <p className="more-data">+ {orgAnalytics.dailySummary.length - 10} more days</p>
                      )}
                    </div>
                  ) : (
                    <p>No organization data available yet.</p>
                  )}
                </div>
                <div className="analytics-card">
                  <h3>Organization Time by Project</h3>
                  {orgAnalytics?.timeByProject && orgAnalytics.timeByProject.length > 0 ? (
                    <div className="data-list">
                      {orgAnalytics.timeByProject.map((project, idx) => (
                        <div key={idx} className="data-item">
                          <span className="label">{project.active_project_key || 'Unknown'}</span>
                          <span className="value">{formatTime(project.total_seconds)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No organization project data available yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'brd-upload' && (
          <div className="brd-upload">
            <h2>Upload BRD Document</h2>
            <div className="upload-container">
              <p>Upload a PDF or DOCX document containing your Business Requirements Document.</p>
              <p>The AI will analyze it and automatically create Jira issues (Epics, Stories, and Tasks).</p>

              <div className="file-input-container">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileSelect}
                  id="file-input"
                />
                <label htmlFor="file-input" className="file-input-label">
                  {selectedFile ? selectedFile.name : 'Choose File (PDF or DOCX)'}
                </label>
              </div>

              {selectedFile && (
                <button className="upload-button" onClick={handleBRDUpload}>
                  Upload and Process
                </button>
              )}

              {processingStatus && (
                <div className="processing-status">
                  <p>{processingStatus}</p>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}

              {currentDocument && (
                <div className="document-status">
                  <h3>Document Status</h3>
                  <p><strong>Status:</strong> {currentDocument.processing_status || 'unknown'}</p>
                  <p><strong>File:</strong> {currentDocument.file_name}</p>

                  {currentDocument.processing_status === 'completed' && (
                    <div className="create-issues-section">
                      <h4>Create Jira Issues</h4>
                      <div className="project-key-input">
                        <label htmlFor="project-key">Project Key:</label>
                        <input
                          type="text"
                          id="project-key"
                          value={projectKey}
                          onChange={(e) => setProjectKey(e.target.value)}
                          placeholder="e.g., PROJ"
                          style={{ marginLeft: '10px', padding: '5px' }}
                        />
                        <button
                          className="create-issues-btn"
                          onClick={handleCreateIssues}
                          disabled={!projectKey.trim()}
                        >
                          Create Issues
                        </button>
                      </div>
                    </div>
                  )}

                  {currentDocument.created_issues && currentDocument.created_issues.length > 0 && (
                    <div className="created-issues">
                      <h4>Created Issues ({currentDocument.created_issues.filter(i => i.key).length})</h4>
                      <ul>
                        {currentDocument.created_issues.map((issue, idx) => (
                          <li key={idx}>
                            {issue.key ? (
                              <a href={`/browse/${issue.key}`} target="_blank" rel="noopener noreferrer">
                                {issue.key} - {issue.type}: {issue.summary}
                              </a>
                            ) : (
                              <span className="error-issue">
                                {issue.error}: {issue.details}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

export default App;
