import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

function App() {
  const [settings, setSettings] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceRoleKey: '',
    screenshotInterval: 300,
    autoWorklogEnabled: true,
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
      if (result.success && result.permissions.isJiraAdmin) {
        setIsAdmin(true);
        loadSettings();
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

  if (!isAdmin) {
    return (
      <div className="App">
        <div className="access-denied">
          <h1>Access Denied</h1>
          <p>Only Jira Administrators can access global settings.</p>
          <p className="help-text">If you need to configure settings, please contact your Jira Administrator.</p>
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
        <h1>BRD Automate & Time Tracker - Settings</h1>
        <p className="subtitle">Configure global application settings (Administrator Only)</p>
        <div className="admin-badge">Jira Administrator</div>
      </header>

      <main className="settings-content">
        <section className="settings-section">
          <h2>Supabase Configuration</h2>
          <p className="section-description">
            Connect to your Supabase backend for data storage and authentication.
          </p>

          <div className="form-group">
            <label htmlFor="supabaseUrl">Supabase URL</label>
            <input
              type="text"
              id="supabaseUrl"
              name="supabaseUrl"
              value={settings.supabaseUrl}
              onChange={handleChange}
              placeholder="https://your-project.supabase.co"
            />
            <small>Your Supabase project URL</small>
          </div>

          <div className="form-group">
            <label htmlFor="supabaseAnonKey">Supabase Anon Key</label>
            <input
              type="password"
              id="supabaseAnonKey"
              name="supabaseAnonKey"
              value={settings.supabaseAnonKey}
              onChange={handleChange}
              placeholder="Enter your anon/public key"
            />
            <small>Your Supabase anonymous/public API key</small>
          </div>

          <div className="form-group">
            <label htmlFor="supabaseServiceRoleKey">Supabase Service Role Key</label>
            <input
              type="password"
              id="supabaseServiceRoleKey"
              name="supabaseServiceRoleKey"
              value={settings.supabaseServiceRoleKey}
              onChange={handleChange}
              placeholder="Enter your service role key"
            />
            <small>Your Supabase service role key (for backend operations). Keep this secure!</small>
          </div>
        </section>

        <section className="settings-section">
          <h2>Time Tracking Configuration</h2>
          <p className="section-description">
            Configure how the desktop app captures screenshots and tracks time.
          </p>

          <div className="form-group">
            <label htmlFor="screenshotInterval">Screenshot Interval (seconds)</label>
            <input
              type="number"
              id="screenshotInterval"
              name="screenshotInterval"
              value={settings.screenshotInterval}
              onChange={handleChange}
              min="60"
              max="3600"
            />
            <small>How often to capture screenshots (60-3600 seconds)</small>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="autoWorklogEnabled"
                checked={settings.autoWorklogEnabled}
                onChange={handleChange}
              />
              <span>Automatically create work logs in Jira</span>
            </label>
            <small>Enable automatic worklog creation based on tracked time</small>
          </div>
        </section>

        <section className="settings-section">
          <h2>AI Server Configuration</h2>
          <p className="section-description">
            Configure the AI analysis server for screenshot processing and BRD automation.
          </p>

          <div className="form-group">
            <label htmlFor="aiServerUrl">AI Server URL</label>
            <input
              type="text"
              id="aiServerUrl"
              name="aiServerUrl"
              value={settings.aiServerUrl}
              onChange={handleChange}
              placeholder="https://your-ai-server.com or http://localhost:5000"
            />
            <small>URL of your AI analysis server</small>
          </div>

          <div className="form-group">
            <label htmlFor="aiServerApiKey">AI Server API Key</label>
            <input
              type="password"
              id="aiServerApiKey"
              name="aiServerApiKey"
              value={settings.aiServerApiKey}
              onChange={handleChange}
              placeholder="Enter your AI server API key (optional)"
            />
            <small>API key for authenticating with the AI server (if required)</small>
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
            <strong>Note:</strong> Make sure to configure the Supabase settings above before installing the desktop app.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
