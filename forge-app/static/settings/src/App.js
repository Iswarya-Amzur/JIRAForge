import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

function App() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setPermissionLoading(true);
    try {
      const result = await invoke('getUserPermissions');
      if (result.success) {
        const jiraAdmin = result.permissions.isJiraAdmin;
        setIsAdmin(jiraAdmin);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('Failed to check permissions:', err);
      setIsAdmin(false);
    } finally {
      setPermissionLoading(false);
      setLoading(false);
    }
  };

  if (permissionLoading || loading) {
    return (
      <div className="App">
        <div className="loading-container">
          <p>Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Check if user is Jira Admin
  if (!isAdmin) {
    return (
      <div className="App">
        <div className="access-denied">
          <h1>Access Denied</h1>
          <p>Only Jira Administrators can access global settings.</p>
          <p className="help-text">Project Administrators can configure Timesheet Settings from the main app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Time Tracker - Settings</h1>
        <p className="subtitle">Application Configuration (Administrator Only)</p>
        <div className="admin-badge">Jira Administrator</div>
      </header>

      <main className="settings-content">
        <section className="settings-section info-section">
          <h2>Secure Configuration</h2>
          <p className="section-description">
            Your Time Tracker is pre-configured with secure backend services. All connections
            are managed automatically - no manual configuration is required.
          </p>
          <div className="secure-badge">
            <span className="checkmark">&#10003;</span> Securely Connected
          </div>
        </section>

        <section className="settings-section info-section">
          <h2>Tracking Settings</h2>
          <p className="section-description">
            Configure screenshot intervals, application blacklists/whitelists, and other tracking
            preferences from the <strong>Time Tracker</strong> panel in any Jira project.
          </p>
          <p className="note">
            Navigate to any project and open the Time Tracker panel to access tracking settings.
          </p>
        </section>

        <section className="settings-section info-section">
          <h2>Desktop App Installation</h2>
          <p className="section-description">
            To start tracking time, install the desktop application:
          </p>
          <ol>
            <li>Download the desktop app for your platform (Windows/macOS/Linux)</li>
            <li>Install and launch the application</li>
            <li>Sign in with your Atlassian account</li>
            <li>The app will automatically start capturing screenshots at the configured interval</li>
          </ol>
          <p className="note">
            <strong>Note:</strong> The app is pre-configured to connect to your organization's backend.
            No additional setup is required.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
