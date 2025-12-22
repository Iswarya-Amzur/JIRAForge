import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';
import UnassignedWork from './components/UnassignedWork';
import TimesheetSettings from './components/TimesheetSettings';

// Helper function to navigate to Jira issues (works within Forge iframe)
const navigateToIssue = (issueKey) => {
  // For Forge apps, we need to navigate in the parent window
  // Try to use parent window navigation
  try {
    if (window.parent && window.parent !== window) {
      // Use parent window to navigate (works in Forge iframe)
      window.parent.location.href = `/browse/${issueKey}`;
    } else {
      // Fallback to same window
      window.location.href = `/browse/${issueKey}`;
    }
  } catch (e) {
    // If cross-origin restrictions prevent parent navigation,
    // the link href will handle it as a fallback
    console.warn('Could not navigate programmatically, using link fallback');
  }
};

// Issue Type Icon Component - displays Jira-like icons for issue types
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
  // Check URL hash for initial tab (e.g., #unassigned-work)
  const getInitialTab = () => {
    try {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['dashboard', 'analytics', 'unassigned-work', 'org-analytics', 'timesheet-settings'];
      if (hash && validTabs.includes(hash)) {
        return hash;
      }
    } catch (e) {
      // Ignore errors in Forge iframe context
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timesheetView, setTimesheetView] = useState('day'); // day, week, month
  const [timeData, setTimeData] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScreenshots, setSelectedScreenshots] = useState(new Set());

  // Month Navigation State
  const [selectedMonth, setSelectedMonth] = useState(new Date());

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

  // Session Reassignment State
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [sessionToReassign, setSessionToReassign] = useState(null); // { session, fromIssueKey }
  const [reassigning, setReassigning] = useState(false);

  // Screenshot Preview State
  const [screenshotPreviewOpen, setScreenshotPreviewOpen] = useState(false);
  const [previewSession, setPreviewSession] = useState(null); // { session, issueKey }
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewScreenshots, setPreviewScreenshots] = useState([]); // Screenshots with signed URLs
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [expandedScreenshot, setExpandedScreenshot] = useState(false); // Fullscreen view

  // Gallery Fullscreen State (for Screenshots tab)
  const [galleryFullscreen, setGalleryFullscreen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Session Reassignment Handlers
  const openReassignModal = (session, fromIssueKey) => {
    setSessionToReassign({ session, fromIssueKey });
    setReassignModalOpen(true);
  };

  const closeReassignModal = () => {
    setReassignModalOpen(false);
    setSessionToReassign(null);
  };

  const handleReassignSession = async (toIssueKey) => {
    if (!sessionToReassign || reassigning) return;

    setReassigning(true);
    try {
      const result = await invoke('reassignSession', {
        analysisResultIds: sessionToReassign.session.analysisResultIds,
        fromIssueKey: sessionToReassign.fromIssueKey,
        toIssueKey: toIssueKey,
        totalSeconds: sessionToReassign.session.duration
      });

      if (result.success) {
        // Refresh issues list to show updated time
        await loadActiveIssues();
        closeReassignModal();
      } else {
        alert(`Failed to reassign session: ${result.error}`);
      }
    } catch (err) {
      console.error('Error reassigning session:', err);
      alert(`Error reassigning session: ${err.message}`);
    } finally {
      setReassigning(false);
    }
  };

  // Screenshot Preview Handlers
  const openScreenshotPreview = async (session, issueKey) => {
    setPreviewSession({ session, issueKey });
    setPreviewImageIndex(0);
    setScreenshotPreviewOpen(true);
    setLoadingScreenshots(true);
    setPreviewScreenshots([]);

    try {
      // Use getSessionScreenshots resolver to get signed URLs for session screenshots
      const result = await invoke('getSessionScreenshots', {
        analysisResultIds: session.analysisResultIds
      });

      if (result.success && result.screenshots) {
        setPreviewScreenshots(result.screenshots);
      } else {
        console.error('Failed to load screenshots:', result.error);
      }
    } catch (err) {
      console.error('Error loading screenshots:', err);
    } finally {
      setLoadingScreenshots(false);
    }
  };

  const closeScreenshotPreview = () => {
    setScreenshotPreviewOpen(false);
    setPreviewSession(null);
    setPreviewImageIndex(0);
    setPreviewScreenshots([]);
    setExpandedScreenshot(false);
  };

  const toggleExpandedScreenshot = () => {
    setExpandedScreenshot(!expandedScreenshot);
  };

  // Gallery Fullscreen Handlers (for Screenshots tab)
  const openGalleryFullscreen = (index) => {
    setGalleryIndex(index);
    setGalleryFullscreen(true);
  };

  const closeGalleryFullscreen = () => {
    setGalleryFullscreen(false);
  };

  const nextGalleryImage = () => {
    if (screenshots.length > 0) {
      setGalleryIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : 0));
    }
  };

  const prevGalleryImage = () => {
    if (screenshots.length > 0) {
      setGalleryIndex((prev) => (prev > 0 ? prev - 1 : screenshots.length - 1));
    }
  };

  const nextPreviewImage = () => {
    if (previewScreenshots.length > 0) {
      setPreviewImageIndex((prev) =>
        prev < previewScreenshots.length - 1 ? prev + 1 : 0
      );
    }
  };

  const prevPreviewImage = () => {
    if (previewScreenshots.length > 0) {
      setPreviewImageIndex((prev) =>
        prev > 0 ? prev - 1 : previewScreenshots.length - 1
      );
    }
  };

  const loadScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getScreenshots');
      if (result.success) {
        setScreenshots(result.data.screenshots);
        // Clear selection when reloading
        setSelectedScreenshots(new Set());
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
        // Remove from selection if it was selected
        setSelectedScreenshots(prev => {
          const newSet = new Set(prev);
          newSet.delete(screenshotId);
          return newSet;
        });
      } else {
        alert('Failed to delete screenshot: ' + result.error);
      }
    } catch (err) {
      alert('Error deleting screenshot: ' + err.message);
    }
  };

  const handleBulkDeleteScreenshots = async () => {
    if (selectedScreenshots.size === 0) return;

    const count = selectedScreenshots.size;
    if (!window.confirm(`Are you sure you want to delete ${count} screenshot${count > 1 ? 's' : ''}?`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedScreenshots).map(screenshotId =>
        invoke('deleteScreenshot', { screenshotId })
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter(r => !r.success);

      if (failed.length > 0) {
        alert(`Failed to delete ${failed.length} screenshot(s). Please try again.`);
      } else {
        // Clear selection and reload
        setSelectedScreenshots(new Set());
        loadScreenshots();
      }
    } catch (err) {
      alert('Error deleting screenshots: ' + err.message);
    }
  };

  const handleToggleSelect = (screenshotId) => {
    setSelectedScreenshots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(screenshotId)) {
        newSet.delete(screenshotId);
      } else {
        newSet.add(screenshotId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedScreenshots.size === screenshots.length) {
      // Deselect all
      setSelectedScreenshots(new Set());
    } else {
      // Select all
      setSelectedScreenshots(new Set(screenshots.map(s => s.id)));
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
        <aside className={`App-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-header">
            <button
              className={`sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
            {sidebarOpen && (
              <h3 className="sidebar-title">Time Tracker</h3>
            )}
          </div>
          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
              title="Dashboard"
            >
              <span className="sidebar-icon">📊</span>
              {sidebarOpen && <span className="sidebar-label">Dashboard</span>}
            </button>
            <button
              className={`sidebar-item ${activeTab === 'time-analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('time-analytics')}
              title="Time Analytics"
            >
              <span className="sidebar-icon">📈</span>
              {sidebarOpen && <span className="sidebar-label">Time Analytics</span>}
            </button>
            {/* Hidden for now - Screenshots page
            <button
              className={`sidebar-item ${activeTab === 'screenshots' ? 'active' : ''}`}
              onClick={() => setActiveTab('screenshots')}
              title="My Screenshots"
            >
              <span className="sidebar-icon">🖼️</span>
              {sidebarOpen && <span className="sidebar-label">My Screenshots</span>}
            </button>
            */}
            <button
              className={`sidebar-item ${activeTab === 'unassigned-work' ? 'active' : ''}`}
              onClick={() => setActiveTab('unassigned-work')}
              title="Unassigned Work"
            >
              <span className="sidebar-icon">⏰</span>
              {sidebarOpen && <span className="sidebar-label">Unassigned Work</span>}
            </button>
            {userPermissions.projectAdminProjects?.length > 0 && (
              <button
                className={`sidebar-item ${activeTab === 'team-analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('team-analytics')}
                title="Team Analytics"
              >
                <span className="sidebar-icon">👥</span>
                {sidebarOpen && <span className="sidebar-label">Team Analytics</span>}
              </button>
            )}
            {userPermissions.isJiraAdmin && (
              <button
                className={`sidebar-item ${activeTab === 'org-analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('org-analytics')}
                title="Organization Analytics"
              >
                <span className="sidebar-icon">🏢</span>
                {sidebarOpen && <span className="sidebar-label">Organization Analytics</span>}
              </button>
            )}
            {/* Timesheet Settings - visible to Jira Admins and Project Admins */}
            {(userPermissions.isJiraAdmin || userPermissions.projectAdminProjects?.length > 0) && (
              <button
                className={`sidebar-item ${activeTab === 'timesheet-settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('timesheet-settings')}
                title="Timesheet Settings"
              >
                <span className="sidebar-icon">⚙️</span>
                {sidebarOpen && <span className="sidebar-label">Timesheet Settings</span>}
              </button>
            )}
            {/* Hidden for now - BRD Upload page
            <button
              className={`sidebar-item ${activeTab === 'brd-upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('brd-upload')}
              title="BRD Upload"
            >
              <span className="sidebar-icon">📄</span>
              {sidebarOpen && <span className="sidebar-label">BRD Upload</span>}
            </button>
            */}
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
                                              // Calculate total duration from stored duration (not time difference)
                                              // This ensures accuracy when sessions are merged
                                              const totalDuration = dateSessions.reduce((sum, s) => {
                                                // Use stored duration if available, otherwise calculate from times
                                                return sum + (s.duration || Math.round((new Date(s.endTime) - new Date(s.startTime)) / 1000));
                                              }, 0);

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
                                                      // Use stored duration (which is the sum of duration_seconds from screenshots)
                                                      // This ensures accuracy when sessions are merged
                                                      const sessionDuration = session.duration || Math.round((end - start) / 1000);
                                                      return (
                                                        <div key={sessionIdx} className="session-item">
                                                          <span className="session-time">
                                                            {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            {' → '}
                                                            {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                          </span>
                                                          <span className="session-duration">
                                                            {formatTime(sessionDuration)}
                                                          </span>
                                                          <div className="session-actions">
                                                            {session.screenshots && session.screenshots.length > 0 && (
                                                              <button
                                                                className="view-screenshots-button"
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  openScreenshotPreview(session, issue.key);
                                                                }}
                                                                title={`View ${session.screenshots.length} screenshot${session.screenshots.length > 1 ? 's' : ''}`}
                                                              >
                                                                🖼️ {session.screenshots.length}
                                                              </button>
                                                            )}
                                                            {session.analysisResultIds && session.analysisResultIds.length > 0 && (
                                                              <button
                                                                className="reassign-button"
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  openReassignModal(session, issue.key);
                                                                }}
                                                                title="Reassign this session to a different issue"
                                                              >
                                                                ✏️
                                                              </button>
                                                            )}
                                                          </div>
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
                        // Helper to normalize work_date to YYYY-MM-DD string
                        const normalizeDate = (workDate) => {
                          if (!workDate) return '';
                          if (typeof workDate === 'string') {
                            return workDate.split('T')[0];
                          } else if (workDate instanceof Date) {
                            return workDate.toISOString().split('T')[0];
                          }
                          return String(workDate).split('T')[0];
                        };

                        // Use LOCAL time formatting (no UTC conversion)
                        const today = new Date();
                        const y = today.getFullYear();
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const d = String(today.getDate()).padStart(2, '0');
                        const todayStr = `${y}-${m}-${d}`;
                        
                        const totalSeconds = timeData?.dailySummary?.filter(day => {
                          const workDateStr = normalizeDate(day.work_date);
                          return workDateStr === todayStr;
                        }).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
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
                        // Use LOCAL time formatting (no UTC conversion)
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = today.getMonth();
                        const date = today.getDate();

                        // Helper to format date as YYYY-MM-DD in local time
                        const formatLocalDate = (d) => {
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const day = String(d.getDate()).padStart(2, '0');
                          return `${y}-${m}-${day}`;
                        };

                        const todayStr = formatLocalDate(today);
                        const startOfWeek = new Date(year, month, date - today.getDay());

                        // Create array of this week's dates
                        const weekDates = Array.from({ length: 7 }, (_, i) => {
                          const weekDate = new Date(year, month, startOfWeek.getDate() + i);
                          return formatLocalDate(weekDate);
                        }).filter(dateStr => dateStr <= todayStr);

                        // Use dailySummary and filter for all days in current week
                        const totalSeconds = timeData?.dailySummary?.filter(day => {
                          // Normalize work_date to string format
                          let workDateStr;
                          if (typeof day.work_date === 'string') {
                            workDateStr = day.work_date.split('T')[0];
                          } else if (day.work_date instanceof Date) {
                            workDateStr = day.work_date.toISOString().split('T')[0];
                          } else {
                            workDateStr = String(day.work_date);
                          }
                          return weekDates.includes(workDateStr);
                        }).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
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
                        // Helper to normalize work_date to YYYY-MM-DD string
                        const normalizeDate = (workDate) => {
                          if (!workDate) return '';
                          if (typeof workDate === 'string') {
                            return workDate.split('T')[0];
                          } else if (workDate instanceof Date) {
                            return workDate.toISOString().split('T')[0];
                          }
                          return String(workDate).split('T')[0];
                        };

                        const today = new Date();
                        const y = today.getFullYear();
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const currentMonth = `${y}-${m}`; // YYYY-MM in local time

                        // Use dailySummary and filter for all days in current month
                        const totalSeconds = timeData?.dailySummary?.filter(day => {
                          const workDateStr = normalizeDate(day.work_date);
                          return workDateStr.startsWith(currentMonth);
                        }).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
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
                    <h3>{timeData?.canViewAllUsers ? 'Daily Timesheet' : 'My Daily Timesheet'} - {(() => {
                      const today = new Date();
                      return today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    })()}</h3>
                  </div>

                  {loading ? (
                    <p>Loading...</p>
                  ) : (
                    <div className="team-members-list">
                      {(() => {
                        // Helper to normalize work_date to YYYY-MM-DD string
                        const normalizeDate = (workDate) => {
                          if (!workDate) return '';
                          if (typeof workDate === 'string') {
                            return workDate.split('T')[0];
                          } else if (workDate instanceof Date) {
                            return workDate.toISOString().split('T')[0];
                          }
                          return String(workDate).split('T')[0];
                        };

                        // Use LOCAL time to match database date parsing
                        const today = new Date();
                        const y = today.getFullYear();
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const d = String(today.getDate()).padStart(2, '0');
                        const todayStr = `${y}-${m}-${d}`;
                        
                        const todayData = timeData?.dailySummary?.filter(day => {
                          const workDateStr = normalizeDate(day.work_date);
                          return workDateStr === todayStr;
                        }) || [];

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
                      today.setHours(0, 0, 0, 0);
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
                            {(() => {
                              // Calculate week dates (same logic as data processing) - Use LOCAL time
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const todayStr = today.toISOString().split('T')[0];
                              const startOfWeek = new Date(today);
                              startOfWeek.setDate(today.getDate() - today.getDay());

                              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                              // Only show columns for days up to today
                              return Array.from({ length: 7 }, (_, i) => {
                                const date = new Date(startOfWeek);
                                date.setDate(startOfWeek.getDate() + i);
                                const dateStr = date.toISOString().split('T')[0];

                                if (dateStr <= todayStr) {
                                  return <th key={i}>{dayNames[date.getDay()]}</th>;
                                }
                                return null;
                              }).filter(Boolean);
                            })()}
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Get current week date range
                            // IMPORTANT: Match month view logic exactly - use local dates, format manually
                            const today = new Date();
                            const year = today.getFullYear();
                            const month = today.getMonth();
                            const date = today.getDate();

                            // Helper to format date as YYYY-MM-DD in local time
                            const formatLocalDate = (d) => {
                              const y = d.getFullYear();
                              const m = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              return `${y}-${m}-${day}`;
                            };

                            const todayDateStr = formatLocalDate(today);

                            // Calculate start of week (Sunday) in LOCAL time
                            const startOfWeek = new Date(year, month, date - today.getDay());

                            // Create array of this week's dates with day info, but only up to today
                            const weekDates = Array.from({ length: 7 }, (_, i) => {
                              const weekDate = new Date(year, month, startOfWeek.getDate() + i);
                              const dateStr = formatLocalDate(weekDate);
                              return {
                                dateStr: dateStr,
                                dayOfWeek: weekDate.getDay(), // 0=Sunday, 1=Monday, etc.
                                date: weekDate
                              };
                            }).filter(item => item.dateStr <= todayDateStr); // Only include dates up to today

                            // Initialize all users with 0 time
                            const userTimeByDay = {};
                            const daysCount = weekDates.length; // Number of days to show (up to today)

                            // First, add all active users with 0 time
                            timeData?.allUsers?.forEach(user => {
                              userTimeByDay[user.id] = {
                                userId: user.id,
                                name: user.display_name || user.email || 'User',
                                days: Array(daysCount).fill(0), // Only create array for days up to today
                                total: 0
                              };
                            });

                            // Then, populate time data for users who have tracked time
                            timeData?.dailySummary?.forEach(day => {
                              // Normalize work_date to string format (handle both DATE and string types)
                              let workDateStr;
                              if (typeof day.work_date === 'string') {
                                // Handle ISO strings like "2025-11-23T00:00:00.000Z" or "2025-11-23"
                                workDateStr = day.work_date.split('T')[0];
                              } else if (day.work_date instanceof Date) {
                                // Handle Date objects
                                workDateStr = day.work_date.toISOString().split('T')[0];
                              } else {
                                // Assume it's already a date string
                                workDateStr = String(day.work_date);
                              }

                              // Only process dates that are in the week AND not in the future
                              const weekDateItem = weekDates.find(item => item.dateStr === workDateStr);
                              if (weekDateItem && workDateStr <= todayDateStr) {
                                const userId = day.user_id || 'current_user';
                                const dayIndex = weekDates.indexOf(weekDateItem);

                                if (!userTimeByDay[userId]) {
                                  // User exists in time data but not in allUsers list (shouldn't happen)
                                  userTimeByDay[userId] = {
                                    userId,
                                    name: day.user_display_name || 'User',
                                    days: Array(daysCount).fill(0),
                                    total: 0
                                  };
                                }
                                if (dayIndex >= 0 && dayIndex < daysCount) {
                                  userTimeByDay[userId].days[dayIndex] += day.total_seconds || 0;
                                  userTimeByDay[userId].total += day.total_seconds || 0;
                                }
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
                                    {Array.from({ length: daysCount }, (_, dayIdx) => {
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
                  <div className="month-header-container">
                    <div className="month-nav">
                      <button 
                        className="month-nav-btn"
                        onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))}
                      >
                        <span className="nav-arrow">‹</span>
                      </button>
                      <div className="month-title-wrapper">
                        <h3 className="month-title">
                          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h3>
                        <span className="month-subtitle">
                          {timeData?.canViewAllUsers ? 'Team Timesheet' : 'My Timesheet'}
                        </span>
                      </div>
                      <button 
                        className="month-nav-btn"
                        onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}
                      >
                        <span className="nav-arrow">›</span>
                      </button>
                    </div>
                    <button 
                      className="today-btn"
                      onClick={() => setSelectedMonth(new Date())}
                    >
                      Today
                    </button>
                  </div>

                  {loading ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      <p>Loading timesheet...</p>
                    </div>
                  ) : (
                    <div className="month-layout">
                      <div className="month-calendar-card">
                        <div className="calendar-card-header">
                          <h4>Calendar View</h4>
                        </div>
                        <table className="calendar-table">
                          <thead>
                            <tr>
                              <th>Mon</th>
                              <th>Tue</th>
                              <th>Wed</th>
                              <th>Thu</th>
                              <th>Fri</th>
                              <th className="weekend">Sat</th>
                              <th className="weekend">Sun</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const today = new Date();
                              const year = selectedMonth.getFullYear();
                              const month = selectedMonth.getMonth();
                              const firstDayOfMonth = new Date(year, month, 1);
                              // Adjust for Monday start (0 = Monday, 6 = Sunday)
                              let firstDay = firstDayOfMonth.getDay() - 1;
                              if (firstDay < 0) firstDay = 6;
                              const daysInMonth = new Date(year, month + 1, 0).getDate();
                              const selectedMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

                              // Create time map by date
                              const timeByDate = {};
                              timeData?.dailySummary?.forEach(day => {
                                let workDateStr;
                                if (typeof day.work_date === 'string') {
                                  workDateStr = day.work_date.split('T')[0];
                                } else if (day.work_date instanceof Date) {
                                  workDateStr = day.work_date.toISOString().split('T')[0];
                                } else {
                                  workDateStr = String(day.work_date);
                                }
                                
                                if (workDateStr.startsWith(selectedMonthStr)) {
                                  const date = new Date(workDateStr + 'T00:00:00');
                                  if (date.getMonth() === month && date.getFullYear() === year) {
                                    const dayNum = date.getDate();
                                    timeByDate[dayNum] = (timeByDate[dayNum] || 0) + (day.total_seconds || 0);
                                  }
                                }
                              });

                              const rows = [];
                              let day = 1;
                              const totalWeeks = Math.ceil((firstDay + daysInMonth) / 7);

                              for (let week = 0; week < totalWeeks; week++) {
                                const cells = [];
                                for (let weekDay = 0; weekDay < 7; weekDay++) {
                                  const dayIndex = week * 7 + weekDay;
                                  if (dayIndex < firstDay || day > daysInMonth) {
                                    cells.push(<td key={weekDay} className="calendar-cell empty"></td>);
                                  } else {
                                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                                    const isWeekend = weekDay >= 5;
                                    const timeTracked = timeByDate[day] || 0;
                                    const currentDay = day;
                                    
                                    cells.push(
                                      <td 
                                        key={weekDay} 
                                        className={`calendar-cell ${isToday ? 'today' : ''} ${timeTracked > 0 ? 'has-time' : ''} ${isWeekend ? 'weekend' : ''}`}
                                      >
                                        <div className="cell-day">{currentDay}</div>
                                        {timeTracked > 0 && (
                                          <div className="cell-time">{formatTime(timeTracked)}</div>
                                        )}
                                      </td>
                                    );
                                    day++;
                                  }
                                }
                                rows.push(<tr key={week}>{cells}</tr>);
                              }

                              return rows;
                            })()}
                          </tbody>
                        </table>
                      </div>

                      {/* Team Summary - Only visible to Admins and Project Admins */}
                      {(userPermissions.isJiraAdmin || userPermissions.projectAdminProjects?.length > 0) && (
                        <div className="team-summary">
                          <h4>Team Summary</h4>
                        <div className="team-summary-list">
                          {(() => {
                            const year = selectedMonth.getFullYear();
                            const month = selectedMonth.getMonth();
                            const selectedMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

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
                              // Normalize work_date to string format (handle both DATE and string types)
                              let workDateStr;
                              if (typeof day.work_date === 'string') {
                                workDateStr = day.work_date.split('T')[0];
                              } else if (day.work_date instanceof Date) {
                                workDateStr = day.work_date.toISOString().split('T')[0];
                              } else {
                                workDateStr = String(day.work_date);
                              }
                              
                              // Check if date is in selected month
                              if (workDateStr && workDateStr.startsWith(selectedMonthStr)) {
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
                <div className="screenshot-toolbar">
                  <p className="screenshot-count">Total: {screenshots.length} screenshots</p>
                  {selectedScreenshots.size > 0 && (
                    <div className="screenshot-bulk-actions">
                      <span className="selected-count">
                        {selectedScreenshots.size} selected
                      </span>
                      <button
                        className="select-all-btn"
                        onClick={handleSelectAll}
                      >
                        {selectedScreenshots.size === screenshots.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        className="bulk-delete-btn"
                        onClick={handleBulkDeleteScreenshots}
                      >
                        Delete Selected ({selectedScreenshots.size})
                      </button>
                    </div>
                  )}
                  {selectedScreenshots.size === 0 && (
                    <button
                      className="select-all-btn"
                      onClick={handleSelectAll}
                    >
                      Select All
                    </button>
                  )}
                </div>
                <div className="screenshot-grid">
                  {screenshots.map((screenshot, index) => (
                    <div
                      key={screenshot.id}
                      className={`screenshot-item ${selectedScreenshots.has(screenshot.id) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="screenshot-checkbox"
                        checked={selectedScreenshots.has(screenshot.id)}
                        onChange={() => handleToggleSelect(screenshot.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select screenshot ${screenshot.id}`}
                      />
                      <button
                        className="screenshot-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this screenshot?')) {
                            handleDeleteScreenshot(screenshot.id);
                          }
                        }}
                        title="Delete screenshot"
                        aria-label="Delete screenshot"
                      />
                      <div
                        className="screenshot-image-wrapper"
                        onClick={() => openGalleryFullscreen(index)}
                        title="Click to expand"
                      >
                        {(screenshot.signed_thumbnail_url || screenshot.thumbnail_url) ? (
                          <img
                            src={screenshot.signed_thumbnail_url || screenshot.thumbnail_url}
                            alt={screenshot.window_title || 'Screenshot'}
                            className="gallery-thumbnail"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                        ) : null}
                        <div className="screenshot-placeholder" style={{ display: (screenshot.signed_thumbnail_url || screenshot.thumbnail_url) ? 'none' : 'block' }}>
                          No Preview
                        </div>
                        <div className="gallery-expand-hint">🔍</div>
                      </div>
                      <div className="screenshot-info">
                        <p className="window-title" title={screenshot.window_title}>
                          {screenshot.window_title || 'Unknown Window'}
                        </p>
                        {screenshot.analysis_results && screenshot.analysis_results.length > 0 && screenshot.analysis_results[0].active_task_key && (
                          <p className="issue-key">
                            <strong>Issue:</strong> {screenshot.analysis_results[0].active_task_key}
                            {screenshot.duration_seconds &&
                              ` (${formatTime(screenshot.duration_seconds)})`
                            }
                          </p>
                        )}
                        {(!screenshot.analysis_results || screenshot.analysis_results.length === 0 || !screenshot.analysis_results[0].active_task_key) && (
                          <p className="issue-key unassigned">
                            <strong>Issue:</strong> Unassigned
                          </p>
                        )}
                        <p className="timestamp">
                          <strong>Time:</strong> {new Date(screenshot.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          })}
                        </p>
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
                            <a 
                              href={`/browse/${issue.issueKey}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigateToIssue(issue.issueKey);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
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
            <p className="admin-notice">Jira Administrator View - Enterprise Overview</p>
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading organization analytics...</p>
              </div>
            ) : error ? (
              <p className="error">Error: {error}</p>
            ) : (
              <>
                {/* Executive Summary KPI Cards */}
                <div className="org-kpi-cards">
                  <div className="org-kpi-card">
                    <div className="kpi-icon">
                      <span>&#128200;</span>
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{orgAnalytics?.orgSummary?.totalHours || 0}h</div>
                      <div className="kpi-label">Total Hours This Month</div>
                      <div className={`kpi-change ${(orgAnalytics?.orgSummary?.totalHoursChange || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {(orgAnalytics?.orgSummary?.totalHoursChange || 0) >= 0 ? '↑' : '↓'} {Math.abs(orgAnalytics?.orgSummary?.totalHoursChange || 0)}% vs last month
                      </div>
                    </div>
                  </div>

                  <div className="org-kpi-card">
                    <div className="kpi-icon">
                      <span>&#128193;</span>
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{orgAnalytics?.orgSummary?.activeProjects || 0}</div>
                      <div className="kpi-label">Active Projects</div>
                      <div className={`kpi-change ${(orgAnalytics?.orgSummary?.projectsChange || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {(orgAnalytics?.orgSummary?.projectsChange || 0) >= 0 ? '+' : ''}{orgAnalytics?.orgSummary?.projectsChange || 0} vs last month
                      </div>
                    </div>
                  </div>

                  <div className="org-kpi-card">
                    <div className="kpi-icon">
                      <span>&#128101;</span>
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{orgAnalytics?.orgSummary?.activeUsers || 0}</div>
                      <div className="kpi-label">Active Users</div>
                      <div className={`kpi-change ${(orgAnalytics?.orgSummary?.activeUsersChange || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {(orgAnalytics?.orgSummary?.activeUsersChange || 0) >= 0 ? '+' : ''}{orgAnalytics?.orgSummary?.activeUsersChange || 0} vs last month
                      </div>
                    </div>
                  </div>

                  <div className="org-kpi-card">
                    <div className="kpi-icon">
                      <span>&#128200;</span>
                    </div>
                    <div className="kpi-content">
                      <div className="kpi-value">{orgAnalytics?.orgSummary?.adoptionRate || 0}%</div>
                      <div className="kpi-label">Adoption Rate</div>
                      <div className="kpi-subtext">
                        {orgAnalytics?.orgSummary?.activeUsers || 0} of {orgAnalytics?.orgSummary?.totalUsers || 0} users
                      </div>
                    </div>
                  </div>
                </div>

                {/* Time By Project & Org Trend Section */}
                <div className="org-charts-row">
                  {/* Time By Project - Horizontal Bar Chart */}
                  <div className="org-chart-card">
                    <div className="chart-header">
                      <h3>Time By Project</h3>
                      <span className="chart-subtitle">Hours tracked this month</span>
                    </div>
                    <div className="project-bars">
                      {(() => {
                        const projects = orgAnalytics?.projectPortfolio || [];
                        const maxHours = Math.max(...projects.map(p => p.totalHours || 0), 1);

                        if (projects.length === 0) {
                          return <p className="empty-state">No project data available</p>;
                        }

                        return projects.slice(0, 8).map((project, idx) => (
                          <div key={idx} className="project-bar-item">
                            <div className="project-bar-label">
                              <span className="project-key">{project.projectKey}</span>
                              <span className="project-hours">{project.totalHours}h</span>
                            </div>
                            <div className="project-bar-container">
                              <div
                                className={`project-bar-fill status-${project.status}`}
                                style={{ width: `${(project.totalHours / maxHours) * 100}%` }}
                              ></div>
                            </div>
                            <div className="project-bar-meta">
                              <span className="contributor-count">{project.contributorCount} contributors</span>
                              <span className={`trend-indicator ${project.trendPercent >= 0 ? 'up' : 'down'}`}>
                                {project.trendPercent >= 0 ? '↑' : '↓'} {Math.abs(project.trendPercent)}%
                              </span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Org Time Trend - Daily Activity */}
                  <div className="org-chart-card">
                    <div className="chart-header">
                      <h3>Organization Activity Trend</h3>
                      <span className="chart-subtitle">Daily hours - Last 30 days</span>
                    </div>
                    <div className="trend-chart">
                      {(() => {
                        // Process daily summary into chart data
                        const dailyData = orgAnalytics?.dailySummary || [];

                        if (dailyData.length === 0) {
                          return <p className="empty-state">No activity data available</p>;
                        }

                        // Aggregate by date
                        const dateAggregation = {};
                        dailyData.forEach(day => {
                          const dateStr = typeof day.work_date === 'string'
                            ? day.work_date.split('T')[0]
                            : String(day.work_date);
                          if (!dateAggregation[dateStr]) {
                            dateAggregation[dateStr] = 0;
                          }
                          dateAggregation[dateStr] += (day.total_seconds || 0) / 3600;
                        });

                        // Sort by date and take last 30 days
                        const sortedDates = Object.keys(dateAggregation).sort().slice(-30);
                        const maxDailyHours = Math.max(...sortedDates.map(d => dateAggregation[d]), 1);

                        return (
                          <div className="trend-bars">
                            {sortedDates.map((dateStr, idx) => {
                              const hours = dateAggregation[dateStr];
                              const height = (hours / maxDailyHours) * 100;
                              const date = new Date(dateStr + 'T00:00:00');
                              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                              return (
                                <div
                                  key={idx}
                                  className={`trend-bar ${isWeekend ? 'weekend' : ''}`}
                                  title={`${dateStr}: ${Math.round(hours * 10) / 10}h`}
                                >
                                  <div
                                    className="trend-bar-fill"
                                    style={{ height: `${Math.max(height, 2)}%` }}
                                  ></div>
                                  {idx % 5 === 0 && (
                                    <span className="trend-bar-label">{date.getDate()}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Project Portfolio Table */}
                <div className="org-portfolio-section">
                  <div className="portfolio-header">
                    <h3>Project Portfolio Details</h3>
                    <span className="portfolio-subtitle">Complete breakdown of project activity this month</span>
                  </div>
                  <div className="portfolio-table-container">
                    <table className="portfolio-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Total Hours</th>
                          <th>Contributors</th>
                          <th>Issues Worked</th>
                          <th>Trend</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const projects = orgAnalytics?.projectPortfolio || [];

                          if (projects.length === 0) {
                            return (
                              <tr>
                                <td colSpan="6" className="empty-state">No project data available</td>
                              </tr>
                            );
                          }

                          return projects.map((project, idx) => (
                            <tr key={idx}>
                              <td className="project-name-cell">
                                <span className="project-badge">{project.projectKey}</span>
                              </td>
                              <td className="hours-cell">
                                <strong>{project.totalHours}h</strong>
                              </td>
                              <td className="contributors-cell">
                                <span className="contributor-badge">{project.contributorCount}</span>
                              </td>
                              <td className="issues-cell">
                                {project.issueCount}
                              </td>
                              <td className={`trend-cell ${project.trendPercent >= 0 ? 'positive' : 'negative'}`}>
                                <span className="trend-value">
                                  {project.trendPercent >= 0 ? '↑' : '↓'} {Math.abs(project.trendPercent)}%
                                </span>
                              </td>
                              <td className="status-cell">
                                <span className={`status-indicator status-${project.status}`}>
                                  {project.status === 'healthy' && 'Healthy'}
                                  {project.status === 'warning' && 'Warning'}
                                  {project.status === 'critical' && 'Critical'}
                                </span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
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
                              <a 
                                href={`/browse/${issue.key}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigateToIssue(issue.key);
                                }}
                                style={{ cursor: 'pointer' }}
                              >
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

        {activeTab === 'unassigned-work' && (
          <UnassignedWork />
        )}

        {/* Timesheet Settings - Admin/Project Admin Only */}
        {activeTab === 'timesheet-settings' && (userPermissions.isJiraAdmin || userPermissions.projectAdminProjects?.length > 0) && (
          <TimesheetSettings />
        )}
      </main>
      </div>

      {/* Session Reassignment Modal */}
      {reassignModalOpen && sessionToReassign && (
        <div className="modal-overlay" onClick={closeReassignModal}>
          <div className="modal-content reassign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reassign Session</h3>
              <button className="modal-close" onClick={closeReassignModal}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="reassign-info">
                Moving <strong>{formatTime(sessionToReassign.session.duration)}</strong> from <strong>{sessionToReassign.fromIssueKey}</strong>
              </p>
              <p className="reassign-prompt">Select the issue to reassign this time to:</p>
              <div className="issue-list-modal">
                {activeIssues
                  .filter(issue => issue.key !== sessionToReassign.fromIssueKey)
                  .map(issue => (
                    <button
                      key={issue.key}
                      className="issue-option"
                      onClick={() => handleReassignSession(issue.key)}
                      disabled={reassigning}
                    >
                      <span className="issue-key">{issue.key}</span>
                      <span className="issue-summary">{issue.summary}</span>
                      <span className={`status-badge status-${issue.statusCategory}`}>{issue.status}</span>
                    </button>
                  ))
                }
                {activeIssues.filter(issue => issue.key !== sessionToReassign.fromIssueKey).length === 0 && (
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
      )}

      {/* Screenshot Preview Modal */}
      {screenshotPreviewOpen && previewSession && (
        <div className="modal-overlay" onClick={closeScreenshotPreview}>
          <div className="modal-content screenshot-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Session Screenshots - {previewSession.issueKey}</h3>
              <button className="modal-close" onClick={closeScreenshotPreview}>&times;</button>
            </div>
            <div className="modal-body screenshot-preview-body">
              {loadingScreenshots ? (
                <div className="loading-screenshots">
                  <div className="spinner"></div>
                  <p>Loading screenshots...</p>
                </div>
              ) : previewScreenshots.length === 0 ? (
                <div className="no-screenshots">
                  <p>No screenshots available for this session.</p>
                </div>
              ) : (
                <>
                  <div className="screenshot-viewer">
                    <div
                      className="screenshot-image-container"
                      onClick={toggleExpandedScreenshot}
                      title="Click to expand"
                    >
                      <img
                        src={previewScreenshots[previewImageIndex]?.signed_url}
                        alt={`Screenshot ${previewImageIndex + 1}`}
                        className="screenshot-preview-image clickable"
                      />
                      <div className="expand-hint">
                        <span>🔍 Click to expand</span>
                      </div>
                    </div>
                    <div className="screenshot-info">
                      <p className="screenshot-app">
                        <strong>Application:</strong> {previewScreenshots[previewImageIndex]?.application_name || 'Unknown'}
                      </p>
                      <p className="screenshot-window">
                        <strong>Window:</strong> {previewScreenshots[previewImageIndex]?.window_title || 'Unknown'}
                      </p>
                      <p className="screenshot-time">
                        <strong>Time:</strong> {previewScreenshots[previewImageIndex]?.timestamp
                          ? new Date(previewScreenshots[previewImageIndex].timestamp).toLocaleString()
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  {previewScreenshots.length > 1 && (
                    <div className="screenshot-navigation">
                      <button className="nav-button prev" onClick={prevPreviewImage}>
                        ◀ Previous
                      </button>
                      <span className="screenshot-counter">
                        {previewImageIndex + 1} of {previewScreenshots.length}
                      </span>
                      <button className="nav-button next" onClick={nextPreviewImage}>
                        Next ▶
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer screenshot-footer">
              <p className="session-summary">
                Session: {new Date(previewSession.session.startTime).toLocaleTimeString()} - {new Date(previewSession.session.endTime).toLocaleTimeString()}
                {' | '}Duration: {formatTime(previewSession.session.duration)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Screenshot Fullscreen View */}
      {expandedScreenshot && previewScreenshots.length > 0 && (
        <div className="fullscreen-overlay" onClick={toggleExpandedScreenshot}>
          <div className="fullscreen-content">
            <button className="fullscreen-close" onClick={toggleExpandedScreenshot}>
              ✕ Close
            </button>
            <img
              src={previewScreenshots[previewImageIndex]?.signed_url}
              alt={`Screenshot ${previewImageIndex + 1}`}
              className="fullscreen-image"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="fullscreen-info">
              <span>{previewScreenshots[previewImageIndex]?.application_name || 'Unknown'}</span>
              <span> | </span>
              <span>{previewScreenshots[previewImageIndex]?.timestamp
                ? new Date(previewScreenshots[previewImageIndex].timestamp).toLocaleString()
                : 'Unknown'}</span>
              <span> | </span>
              <span>{previewImageIndex + 1} of {previewScreenshots.length}</span>
            </div>
            {previewScreenshots.length > 1 && (
              <>
                <button
                  className="fullscreen-nav fullscreen-prev"
                  onClick={(e) => { e.stopPropagation(); prevPreviewImage(); }}
                >
                  ◀
                </button>
                <button
                  className="fullscreen-nav fullscreen-next"
                  onClick={(e) => { e.stopPropagation(); nextPreviewImage(); }}
                >
                  ▶
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Gallery Fullscreen View (for Screenshots tab) */}
      {galleryFullscreen && screenshots.length > 0 && (
        <div className="fullscreen-overlay" onClick={closeGalleryFullscreen}>
          <div className="fullscreen-content">
            <button className="fullscreen-close" onClick={closeGalleryFullscreen}>
              ✕ Close
            </button>
            <img
              src={screenshots[galleryIndex]?.signed_full_url || screenshots[galleryIndex]?.signed_thumbnail_url || screenshots[galleryIndex]?.thumbnail_url}
              alt={`Screenshot ${galleryIndex + 1}`}
              className="fullscreen-image"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="fullscreen-info">
              <span>{screenshots[galleryIndex]?.application_name || 'Unknown App'}</span>
              <span> | </span>
              <span>{screenshots[galleryIndex]?.window_title || 'Unknown Window'}</span>
              <span> | </span>
              <span>{screenshots[galleryIndex]?.timestamp
                ? new Date(screenshots[galleryIndex].timestamp).toLocaleString()
                : 'Unknown'}</span>
              <span> | </span>
              <span>{galleryIndex + 1} of {screenshots.length}</span>
            </div>
            {screenshots.length > 1 && (
              <>
                <button
                  className="fullscreen-nav fullscreen-prev"
                  onClick={(e) => { e.stopPropagation(); prevGalleryImage(); }}
                >
                  ◀
                </button>
                <button
                  className="fullscreen-nav fullscreen-next"
                  onClick={(e) => { e.stopPropagation(); nextGalleryImage(); }}
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

export default App;
