import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './TimesheetSettings.css';

// Common applications for quick selection
const COMMON_WORK_APPS = [
  { name: 'VS Code', value: 'vscode' },
  { name: 'GitHub', value: 'github' },
  { name: 'GitLab', value: 'gitlab' },
  { name: 'JIRA', value: 'jira' },
  { name: 'Confluence', value: 'confluence' },
  { name: 'Slack', value: 'slack' },
  { name: 'Microsoft Teams', value: 'teams' },
  { name: 'Zoom', value: 'zoom' },
  { name: 'Chrome', value: 'chrome' },
  { name: 'Firefox', value: 'firefox' },
  { name: 'IntelliJ IDEA', value: 'intellij' },
  { name: 'Postman', value: 'postman' },
  { name: 'Figma', value: 'figma' },
  { name: 'Notion', value: 'notion' }
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

// Interval marks for slider
const INTERVAL_MARKS = [
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 600, label: '10m' },
  { value: 900, label: '15m' },
  { value: 1800, label: '30m' },
  { value: 2700, label: '45m' },
  { value: 3600, label: '1h' }
];

function TimesheetSettings() {
  const [settings, setSettings] = useState({
    // Screenshot Monitoring
    screenshotMonitoringEnabled: true,
    screenshotIntervalSeconds: 900,

    // Tracking Mode - Both can be enabled
    intervalTrackingEnabled: true,
    eventTrackingEnabled: false,
    trackWindowChanges: true,
    trackIdleTime: true,
    idleThresholdSeconds: 300,

    // Whitelist
    whitelistEnabled: true,
    whitelistedApps: ['vscode', 'jira', 'zoom', 'chrome', 'postman', 'github'],

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
        <div className="loading-spinner">Loading settings...</div>
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
          <div className="section-icon">📷</div>
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
                  min="60"
                  max="3600"
                  step="60"
                  value={settings.screenshotIntervalSeconds}
                  onChange={(e) => handleChange('screenshotIntervalSeconds', parseInt(e.target.value))}
                  className="interval-slider"
                  style={{
                    background: `linear-gradient(to right, #36B37E 0%, #36B37E ${((settings.screenshotIntervalSeconds - 60) / (3600 - 60)) * 100}%, #DFE1E6 ${((settings.screenshotIntervalSeconds - 60) / (3600 - 60)) * 100}%, #DFE1E6 100%)`
                  }}
                />
                <div className="interval-marks">
                  {INTERVAL_MARKS.map(mark => (
                    <span
                      key={mark.value}
                      className={`interval-mark ${settings.screenshotIntervalSeconds >= mark.value ? 'active' : ''}`}
                      style={{ left: `${((mark.value - 60) / (3600 - 60)) * 100}%` }}
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
                  <span className="mode-icon">⏰</span>
                  <span className="mode-name">Interval Based</span>
                  <span className="mode-desc">Capture at fixed intervals</span>
                </button>
                <button
                  className={`mode-option ${settings.eventTrackingEnabled ? 'active' : ''}`}
                  onClick={() => handleToggle('eventTrackingEnabled')}
                >
                  <span className="mode-icon">🎯</span>
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
          <div className="section-icon">✅</div>
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
          <div className="section-icon">🚫</div>
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
                <span className="threshold-icon">🚩</span>
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
          <div className="section-icon">🔒</div>
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
          {message.type === 'success' ? '✓' : '⚠'} {message.text}
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
              💾 Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default TimesheetSettings;
