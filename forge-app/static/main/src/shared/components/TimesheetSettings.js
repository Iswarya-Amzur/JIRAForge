import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './TimesheetSettings.css';

// Common applications for quick selection
// Includes both friendly names and common exe names for better matching
const COMMON_WORK_APPS = [
  { name: 'VS Code', value: 'code' },  // Matches Code.exe
  { name: 'Cursor IDE', value: 'cursor' },  // Matches Cursor.exe
  { name: 'GitHub', value: 'github' },
  { name: 'GitLab', value: 'gitlab' },
  { name: 'JIRA', value: 'jira' },
  { name: 'Confluence', value: 'confluence' },
  { name: 'Slack', value: 'slack' },
  { name: 'Microsoft Teams', value: 'teams' },
  { name: 'Zoom', value: 'zoom' },
  { name: 'Chrome', value: 'chrome' },  // Matches chrome.exe
  { name: 'Firefox', value: 'firefox' },
  { name: 'Edge', value: 'msedge' },  // Matches msedge.exe
  { name: 'IntelliJ IDEA', value: 'intellij' },
  { name: 'Postman', value: 'postman' },
  { name: 'Figma', value: 'figma' },
  { name: 'Notion', value: 'notion' },
  { name: 'Terminal', value: 'terminal' },
  { name: 'PowerShell', value: 'powershell' }
];

const COMMON_NON_WORK_APPS = [
  { name: 'Netflix', value: 'netflix' },
  { name: 'Amazon Prime Video', value: 'primevideo' },
  { name: 'YouTube', value: 'youtube' },
  { name: 'Facebook', value: 'facebook' },
  { name: 'Instagram', value: 'instagram' },
  { name: 'Twitter', value: 'twitter' },
  { name: 'TikTok', value: 'tiktok' },
  { name: 'Spotify', value: 'spotify' },
  { name: 'WhatsApp', value: 'whatsapp' },
  { name: 'Telegram', value: 'telegram' },
  { name: 'Discord', value: 'discord' },
  { name: 'Steam', value: 'steam' },
  { name: 'Epic Games', value: 'epicgames' },
  { name: 'Twitch', value: 'twitch' },
  { name: 'Reddit', value: 'reddit' },
  { name: 'Pinterest', value: 'pinterest' }
];

// Interval marks for slider (5 minute increments)
const INTERVAL_MARKS = [
  { value: 300, label: '5m' },
  { value: 600, label: '10m' },
  { value: 900, label: '15m' },
  { value: 1200, label: '20m' },
  { value: 1500, label: '25m' },
  { value: 1800, label: '30m' },
  { value: 2100, label: '35m' },
  { value: 2400, label: '40m' },
  { value: 2700, label: '45m' },
  { value: 3000, label: '50m' },
  { value: 3300, label: '55m' },
  { value: 3600, label: '60m' }
];

function TimesheetSettings() {
  const [settings, setSettings] = useState({
    // Screenshot Monitoring
    screenshotMonitoringEnabled: true,
    screenshotIntervalSeconds: 300,

    // Tracking Mode - Both can be enabled
    intervalTrackingEnabled: true,
    eventTrackingEnabled: false,
    trackWindowChanges: true,
    trackIdleTime: true,
    idleThresholdSeconds: 300,

    // Whitelist
    whitelistEnabled: true,
    whitelistedApps: ['code', 'cursor', 'jira', 'zoom', 'chrome', 'postman', 'github', 'slack', 'teams'],

    // Blacklist
    blacklistEnabled: true,
    blacklistedApps: ['netflix', 'spotify', 'telegram', 'tiktok', 'pinterest'],
    nonWorkThresholdPercent: 30,
    flagExcessiveNonWork: true,

    // Private Sites
    privateSitesEnabled: true,
    privateSites: []
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Input states for adding custom items
  const [customWhitelistApp, setCustomWhitelistApp] = useState('');
  const [customBlacklistApp, setCustomBlacklistApp] = useState('');
  const [customPrivateSite, setCustomPrivateSite] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await invoke('getTrackingSettings');
      if (result.success && result.settings) {
        setSettings(prev => ({
          ...prev,
          ...result.settings
        }));
      }
    } catch (err) {
      console.error('Failed to load tracking settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await invoke('saveTrackingSettings', { settings });
      if (result.success) {
        setMessage({ type: 'success', text: 'Timesheet settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // Toggle handlers
  const handleToggle = (field) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  // App list handlers
  const addToList = (listField, value) => {
    if (!value.trim()) return;
    const normalizedValue = value.toLowerCase().trim().replace(/\s+/g, '');
    if (!settings[listField].includes(normalizedValue)) {
      setSettings(prev => ({
        ...prev,
        [listField]: [...prev[listField], normalizedValue]
      }));
    }
  };

  const removeFromList = (listField, value) => {
    setSettings(prev => ({
      ...prev,
      [listField]: prev[listField].filter(item => item !== value)
    }));
  };

  const toggleCommonApp = (listField, value) => {
    if (settings[listField].includes(value)) {
      removeFromList(listField, value);
    } else {
      addToList(listField, value);
    }
  };

  const handleAddCustomWhitelist = () => {
    addToList('whitelistedApps', customWhitelistApp);
    setCustomWhitelistApp('');
  };

  const handleAddCustomBlacklist = () => {
    addToList('blacklistedApps', customBlacklistApp);
    setCustomBlacklistApp('');
  };

  const handleAddPrivateSite = () => {
    addToList('privateSites', customPrivateSite);
    setCustomPrivateSite('');
  };

  // Format interval for display
  const formatInterval = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  // Get threshold color class
  const getThresholdColorClass = (value) => {
    if (value <= 30) return 'threshold-normal';
    if (value <= 50) return 'threshold-moderate';
    return 'threshold-high';
  };

  if (loading) {
    return (
      <div className="timesheet-settings loading">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="timesheet-settings">
      <div className="settings-header">
        <h1>Timesheet Settings</h1>
        <p className="settings-subtitle">
          Configure time tracking, screenshots, and monitoring preferences
        </p>
      </div>

      {/* Screenshot Monitoring Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 3H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 17C14.2091 17 16 15.2091 16 13C16 10.7909 14.2091 9 12 9C9.79086 9 8 10.7909 8 13C8 15.2091 9.79086 17 12 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Screenshot Monitoring</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.screenshotMonitoringEnabled}
              onChange={() => handleToggle('screenshotMonitoringEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              {settings.screenshotMonitoringEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {settings.screenshotMonitoringEnabled && (
          <div className="section-content">
            <div className="form-group">
              <label>Screenshot Interval</label>
              <p className="field-description">
                Interval: {formatInterval(settings.screenshotIntervalSeconds)}
              </p>
              <div className="interval-slider-container">
                <input
                  type="range"
                  min="300"
                  max="3600"
                  step="300"
                  value={settings.screenshotIntervalSeconds}
                  onChange={(e) => handleChange('screenshotIntervalSeconds', parseInt(e.target.value))}
                  className="interval-slider"
                  style={{
                    background: `linear-gradient(to right, #36B37E 0%, #36B37E ${((settings.screenshotIntervalSeconds - 300) / (3600 - 300)) * 100}%, #DFE1E6 ${((settings.screenshotIntervalSeconds - 300) / (3600 - 300)) * 100}%, #DFE1E6 100%)`
                  }}
                />
                <div className="interval-marks">
                  {INTERVAL_MARKS.map(mark => (
                    <span
                      key={mark.value}
                      className={`interval-mark ${settings.screenshotIntervalSeconds >= mark.value ? 'active' : ''}`}
                      style={{ left: `${((mark.value - 300) / (3600 - 300)) * 100}%` }}
                    >
                      {mark.label}
                    </span>
                  ))}
                </div>
              </div>
              <p className="field-hint">
                Screenshots will be captured every {formatInterval(settings.screenshotIntervalSeconds)} during active time tracking sessions
              </p>
            </div>

            {/* Tracking Mode */}
            <div className="form-group tracking-mode-group">
              <label>Tracking Mode</label>
              <div className="tracking-mode-options">
                <button
                  className={`mode-option ${settings.intervalTrackingEnabled ? 'active' : ''}`}
                  onClick={() => handleToggle('intervalTrackingEnabled')}
                >
                  <span className="mode-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="mode-name">Interval Based</span>
                  <span className="mode-desc">Capture at fixed intervals</span>
                </button>
                <button
                  className={`mode-option ${settings.eventTrackingEnabled ? 'active' : ''}`}
                  onClick={() => handleToggle('eventTrackingEnabled')}
                >
                  <span className="mode-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="mode-name">Event Based</span>
                  <span className="mode-desc">Capture on activity changes</span>
                </button>
              </div>
            </div>

            {/* Event-based tracking options */}
            {settings.eventTrackingEnabled && (
              <div className="event-tracking-options">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.trackWindowChanges}
                      onChange={() => handleToggle('trackWindowChanges')}
                    />
                    <span>Track window/app changes</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.trackIdleTime}
                      onChange={() => handleToggle('trackIdleTime')}
                    />
                    <span>Track idle time</span>
                  </label>
                </div>
                <div className="form-group">
                  <label>Idle Threshold (seconds)</label>
                  <input
                    type="number"
                    min="60"
                    max="1800"
                    value={settings.idleThresholdSeconds}
                    onChange={(e) => handleChange('idleThresholdSeconds', parseInt(e.target.value))}
                  />
                  <p className="field-hint">Mark as idle after {settings.idleThresholdSeconds} seconds of inactivity</p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Whitelisted Applications Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Whitelisted Applications</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.whitelistEnabled}
              onChange={() => handleToggle('whitelistEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Enable Whitelist</span>
          </label>
        </div>

        {settings.whitelistEnabled && (
          <div className="section-content">
            <p className="field-description">
              Applications that should be actively tracked during time monitoring
            </p>

            {/* Common Applications */}
            <div className="common-apps-container">
              <label className="common-apps-label">Common Applications</label>
              <div className="common-apps-grid">
                {COMMON_WORK_APPS.map(app => (
                  <button
                    key={app.value}
                    className={`app-chip ${settings.whitelistedApps.includes(app.value) ? 'selected' : ''}`}
                    onClick={() => toggleCommonApp('whitelistedApps', app.value)}
                  >
                    {app.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Application Input */}
            <div className="custom-input-container">
              <label>Add Custom Application</label>
              <div className="input-with-button">
                <input
                  type="text"
                  placeholder="e.g., figma, notion, custom-app"
                  value={customWhitelistApp}
                  onChange={(e) => setCustomWhitelistApp(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustomWhitelist()}
                />
                <button
                  className="add-button"
                  onClick={handleAddCustomWhitelist}
                  disabled={!customWhitelistApp.trim()}
                >
                  +
                </button>
              </div>
            </div>

            {/* Current Whitelist */}
            <div className="current-list">
              <label>Current Whitelist ({settings.whitelistedApps.length})</label>
              <div className="tags-container">
                {settings.whitelistedApps.map(app => (
                  <span key={app} className="tag whitelist-tag">
                    {app}
                    <button
                      className="tag-remove"
                      onClick={() => removeFromList('whitelistedApps', app)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Blacklisted Applications Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.93 4.93L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Blacklisted Applications</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.blacklistEnabled}
              onChange={() => handleToggle('blacklistEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Enable Blacklist</span>
          </label>
        </div>

        {settings.blacklistEnabled && (
          <div className="section-content">
            <p className="field-description">
              Non-productive applications that should not be tracked or monitored (e.g., entertainment, social media)
            </p>

            {/* Common Non-Work Applications */}
            <div className="common-apps-container">
              <label className="common-apps-label">Common Non-Productive Applications</label>
              <div className="common-apps-grid">
                {COMMON_NON_WORK_APPS.map(app => (
                  <button
                    key={app.value}
                    className={`app-chip blacklist-chip ${settings.blacklistedApps.includes(app.value) ? 'selected' : ''}`}
                    onClick={() => toggleCommonApp('blacklistedApps', app.value)}
                  >
                    {app.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Application Input */}
            <div className="custom-input-container">
              <label>Add Custom Application</label>
              <div className="input-with-button">
                <input
                  type="text"
                  placeholder="e.g., custom-game, entertainment-app"
                  value={customBlacklistApp}
                  onChange={(e) => setCustomBlacklistApp(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustomBlacklist()}
                />
                <button
                  className="add-button blacklist-add"
                  onClick={handleAddCustomBlacklist}
                  disabled={!customBlacklistApp.trim()}
                >
                  +
                </button>
              </div>
            </div>

            {/* Current Blacklist */}
            <div className="current-list">
              <label>Current Blacklist ({settings.blacklistedApps.length})</label>
              <div className="tags-container">
                {settings.blacklistedApps.map(app => (
                  <span key={app} className="tag blacklist-tag">
                    {app}
                    <button
                      className="tag-remove"
                      onClick={() => removeFromList('blacklistedApps', app)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Flag Excessive Non-Work Activity */}
            <div className="threshold-section">
              <div className="threshold-header">
                <span className="threshold-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 15C4 15 5 14 8 14C11 14 13 16 16 16C19 16 20 15 20 15V3C20 3 19 4 16 4C13 4 11 2 8 2C5 2 4 3 4 3V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 22V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <h3>Flag Users for Excessive Non-Work Activity</h3>
              </div>
              <p className="field-description">
                Set the percentage threshold for weekly blacklisted app usage that will flag users for excessive non-work activities.
                Users exceeding this threshold will be highlighted with a red indicator.
              </p>
              <div className="threshold-slider-container">
                <span className="threshold-value">
                  Threshold: {settings.nonWorkThresholdPercent}% of weekly time
                </span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={settings.nonWorkThresholdPercent}
                  onChange={(e) => handleChange('nonWorkThresholdPercent', parseInt(e.target.value))}
                  className={`threshold-slider ${getThresholdColorClass(settings.nonWorkThresholdPercent)}`}
                />
                <div className="threshold-legend">
                  <span className="legend-item normal">● 10-30%: Normal usage</span>
                  <span className="legend-item moderate">● 40-50%: Moderate usage</span>
                  <span className="legend-item high">● 60%+: High usage (flagged)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Private Work Sites Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Private Work Sites</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.privateSitesEnabled}
              onChange={() => handleToggle('privateSitesEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Enable Private Sites</span>
          </label>
        </div>

        {settings.privateSitesEnabled && (
          <div className="section-content">
            <p className="field-description">
              Websites and applications that should be omitted from tracking (e.g., banking, personal, healthcare)
            </p>

            {/* Custom Private Site Input */}
            <div className="custom-input-container">
              <label>Add Private Site/Domain</label>
              <div className="input-with-button">
                <input
                  type="text"
                  placeholder="e.g., banking, personal, healthcare"
                  value={customPrivateSite}
                  onChange={(e) => setCustomPrivateSite(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddPrivateSite()}
                />
                <button
                  className="add-button private-add"
                  onClick={handleAddPrivateSite}
                  disabled={!customPrivateSite.trim()}
                >
                  +
                </button>
              </div>
            </div>

            {/* Current Private List */}
            <div className="current-list">
              <label>Current Private List ({settings.privateSites.length})</label>
              {settings.privateSites.length === 0 ? (
                <p className="empty-list-message">No private sites configured</p>
              ) : (
                <div className="tags-container">
                  {settings.privateSites.map(site => (
                    <span key={site} className="tag private-tag">
                      {site}
                      <button
                        className="tag-remove"
                        onClick={() => removeFromList('privateSites', site)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Message Display */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.9011 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9011 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )} {message.text}
        </div>
      )}

      {/* Save Button */}
      <div className="actions">
        <button
          className="save-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <span className="spinner"></span>
              Saving...
            </>
          ) : (
            <>
             
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default TimesheetSettings;
