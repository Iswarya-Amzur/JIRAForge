import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

function App() {
  // Note: Supabase credentials are now managed securely by the AI server
  // Only AI server URL is configurable (optional for self-hosted deployments)
  const [settings, setSettings] = useState({
    aiServerUrl: '',
    aiServerApiKey: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
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
        
        if (jiraAdmin) {
          loadSettings();
        } else {
          setPermissionLoading(false);
        }
      } else {
        setIsAdmin(false);
        setPermissionLoading(false);
      }
    } catch (err) {
      console.error('Failed to check permissions:', err);
      setIsAdmin(false);
      setPermissionLoading(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await invoke('getSettings');
      if (result.success) {
        setSettings(prevSettings => ({
          ...prevSettings,
          ...result.settings
        }));
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load settings: ' + err.message });
    } finally {
      setLoading(false);
      setPermissionLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await invoke('saveSettings', { settings });
      if (result.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  if (permissionLoading) {
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

  if (loading) {
    return (
      <div className="App">
        <div className="loading-container">
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Time Tracker - Settings</h1>
        <p className="subtitle">Configure global application settings (Administrator Only)</p>
        <div className="admin-badge">Jira Administrator</div>
      </header>

      <main className="settings-content">
        <section className="settings-section info-section">
          <h2>Secure Configuration</h2>
          <p className="section-description">
            Your Time Tracker is pre-configured with secure backend services. Database credentials
            are managed securely on the server side - no sensitive keys are stored in Jira.
          </p>
          <div className="secure-badge">
            <span className="checkmark">&#10003;</span> Securely Connected
          </div>
        </section>

        <section className="settings-section">
          <h2>AI Server Configuration (Optional)</h2>
          <p className="section-description">
            For self-hosted deployments, you can configure a custom AI server URL.
            Most users can skip this section - the default server is pre-configured.
          </p>

          <div className="form-group">
            <label htmlFor="aiServerUrl">AI Server URL (Optional)</label>
            <input
              type="text"
              id="aiServerUrl"
              name="aiServerUrl"
              value={settings.aiServerUrl}
              onChange={handleChange}
              placeholder="Leave empty to use default server"
            />
            <small>Custom AI server URL for self-hosted deployments</small>
          </div>

          <div className="form-group">
            <label htmlFor="aiServerApiKey">AI Server API Key (Optional)</label>
            <input
              type="password"
              id="aiServerApiKey"
              name="aiServerApiKey"
              value={settings.aiServerApiKey}
              onChange={handleChange}
              placeholder="Enter your AI server API key (optional)"
            />
            <small>API key for authenticating with a custom AI server</small>
          </div>
        </section>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="actions">
          <button
            className="save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <section className="settings-section info-section">
          <h2>Desktop App Installation</h2>
          <p className="section-description">
            To start tracking time, you need to install the desktop application:
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
