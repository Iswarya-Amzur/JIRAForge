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

  // Form states
  const [selectedIssueKey, setSelectedIssueKey] = useState('');
  const [newIssueSummary, setNewIssueSummary] = useState('');
  const [newIssueDescription, setNewIssueDescription] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [issueType, setIssueType] = useState('Task');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadUnassignedWork();
    loadUserIssues();
    loadUserProjects();
  }, []);

  const loadUnassignedWork = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getUnassignedWork', { limit: 100 });

      if (result.success) {
        setSessions(result.sessions || []);

        // Auto-cluster if we have sessions
        if (result.sessions && result.sessions.length > 0) {
          await clusterSessions(result.sessions);
        }
      } else {
        setError(result.error || 'Failed to load unassigned work');
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
      const result = await invoke('getUserAssignedIssues');
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

  const clusterSessions = async (sessionsToCluster) => {
    setClustering(true);
    try {
      const result = await invoke('clusterUnassignedWork', { sessions: sessionsToCluster });

      if (result.success) {
        setGroups(result.groups || []);
      } else {
        console.error('Clustering failed:', result.error);
        setError('Failed to cluster sessions: ' + result.error);
      }
    } catch (err) {
      console.error('Error clustering sessions:', err);
      setError('Error clustering sessions: ' + err.message);
    } finally {
      setClustering(false);
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

    setAssigning(true);
    try {
      const result = await invoke('assignToExistingIssue', {
        sessionIds: selectedGroup.session_ids,
        issueKey: selectedIssueKey,
        groupId: generateGroupId(),
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

    setAssigning(true);
    try {
      const result = await invoke('createIssueAndAssign', {
        sessionIds: selectedGroup.session_ids,
        issueSummary: newIssueSummary,
        issueDescription: newIssueDescription,
        projectKey: selectedProject,
        issueType: issueType,
        totalSeconds: selectedGroup.total_seconds,
        groupId: generateGroupId()
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

  const generateGroupId = () => {
    return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const getTotalTime = () => {
    return sessions.reduce((sum, s) => sum + (s.time_spent_seconds || 0), 0);
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
        <h2>Unassigned Work</h2>
        <div className="unassigned-work-summary">
          <span className="summary-item">
            <strong>{sessions.length}</strong> sessions
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
      </div>

      {clustering && (
        <div className="clustering-message">
          AI is grouping your work sessions...
        </div>
      )}

      {groups.length === 0 && !clustering && (
        <div className="no-groups-message">
          No groups created. Click "Re-cluster" to group sessions.
          <button onClick={() => clusterSessions(sessions)}>Re-cluster</button>
        </div>
      )}

      <div className="groups-list">
        {groups.map((group, index) => (
          <div key={index} className={`group-card confidence-${group.confidence}`}>
            <div className="group-header">
              <h3 className="group-label">{group.label}</h3>
              <span className={`confidence-badge confidence-${group.confidence}`}>
                {group.confidence} confidence
              </span>
            </div>

            <p className="group-description">{group.description}</p>

            <div className="group-stats">
              <div className="stat">
                <span className="stat-label">Sessions:</span>
                <span className="stat-value">{group.session_count}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Total Time:</span>
                <span className="stat-value">{group.total_time_formatted}</span>
              </div>
            </div>

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

            <button
              className="assign-button"
              onClick={() => handleAssignClick(group)}
            >
              Assign This Group
            </button>
          </div>
        ))}
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
    </div>
  );
}

export default UnassignedWork;
