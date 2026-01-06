import React, { useState } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';
import './components/common/Sidebar.css';
import './components/modals/Modals.css';
import UnassignedWork from './components/UnassignedWork';
import TimesheetSettings from './shared/components/TimesheetSettings';
import { DashboardTab, TimeAnalyticsTab, TeamAnalyticsTab, OrgAnalyticsTab, ScreenshotsTab, BRDUploadTab } from './components/tabs';
import { SessionReassignModal, ScreenshotPreviewModal, FullscreenViewer } from './components/modals';
import { AppProvider, useApp } from './context';
import { getInitialTab } from './utils';

function AppContent() {
  const { userPermissions, activeIssues, loadActiveIssues } = useApp();

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Session Reassignment State
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [sessionToReassign, setSessionToReassign] = useState(null);
  const [reassigning, setReassigning] = useState(false);

  // Screenshot Preview State
  const [screenshotPreviewOpen, setScreenshotPreviewOpen] = useState(false);
  const [previewSession, setPreviewSession] = useState(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewScreenshots, setPreviewScreenshots] = useState([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [expandedScreenshot, setExpandedScreenshot] = useState(false);

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
            <button
              className={`sidebar-item ${activeTab === 'unassigned-work' ? 'active' : ''}`}
              onClick={() => setActiveTab('unassigned-work')}
              title="Unassigned Work"
            >
              <span className="sidebar-icon">⏰</span>
              {sidebarOpen && <span className="sidebar-label">Unassigned Work</span>}
            </button>
            {(userPermissions.projectAdminProjects?.length > 0 || (userPermissions.isJiraAdmin && userPermissions.allProjectKeys?.length > 0)) && (
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
            {userPermissions.isJiraAdmin && (
              <button
                className={`sidebar-item ${activeTab === 'timesheet-settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('timesheet-settings')}
                title="Timesheet Settings"
              >
                <span className="sidebar-icon">⚙️</span>
                {sidebarOpen && <span className="sidebar-label">Timesheet Settings</span>}
              </button>
            )}
          </nav>
        </aside>

        <main className="App-content">
          {activeTab === 'dashboard' && (
            <DashboardTab
              onOpenScreenshotPreview={openScreenshotPreview}
              onOpenReassignModal={openReassignModal}
            />
          )}
          {activeTab === 'time-analytics' && <TimeAnalyticsTab />}
          {activeTab === 'screenshots' && <ScreenshotsTab />}
          {activeTab === 'team-analytics' && <TeamAnalyticsTab />}
          {activeTab === 'org-analytics' && <OrgAnalyticsTab />}
          {activeTab === 'brd-upload' && <BRDUploadTab />}
          {activeTab === 'unassigned-work' && <UnassignedWork />}
          {activeTab === 'timesheet-settings' && userPermissions.isJiraAdmin && (
            <TimesheetSettings />
          )}
        </main>
      </div>

      <SessionReassignModal
        isOpen={reassignModalOpen}
        sessionToReassign={sessionToReassign}
        activeIssues={activeIssues}
        reassigning={reassigning}
        onClose={closeReassignModal}
        onReassign={handleReassignSession}
      />

      <ScreenshotPreviewModal
        isOpen={screenshotPreviewOpen}
        previewSession={previewSession}
        previewScreenshots={previewScreenshots}
        previewImageIndex={previewImageIndex}
        loadingScreenshots={loadingScreenshots}
        onClose={closeScreenshotPreview}
        onPrev={prevPreviewImage}
        onNext={nextPreviewImage}
        onExpand={toggleExpandedScreenshot}
      />

      <FullscreenViewer
        isOpen={expandedScreenshot}
        screenshots={previewScreenshots}
        currentIndex={previewImageIndex}
        onClose={toggleExpandedScreenshot}
        onPrev={prevPreviewImage}
        onNext={nextPreviewImage}
      />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
