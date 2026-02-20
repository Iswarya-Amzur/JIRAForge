import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './TimesheetSettings.css';

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

    // Productive Apps (formerly whitelist)
    whitelistEnabled: true,
    whitelistedApps: [],  // Loaded from application_classifications table

    // Non-Productive Apps (formerly blacklist)
    blacklistEnabled: true,
    blacklistedApps: [],  // Loaded from application_classifications table,
    nonWorkThresholdPercent: 30,
    flagExcessiveNonWork: true,

    // Private Sites
    privateSitesEnabled: true,
    privateSites: [],

    // Jira Worklog Sync
    jiraWorklogSyncEnabled: false
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Project selection for project-level settings
  const [selectedProject, setSelectedProject] = useState(null); // null = organization-wide
  const [availableProjects, setAvailableProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [settingsSource, setSettingsSource] = useState('organization'); // 'project', 'organization', or 'global'
  
  // Classifications fetched from database
  const [productiveApps, setProductiveApps] = useState([]);
  const [nonProductiveApps, setNonProductiveApps] = useState([]);
  const [privateApps, setPrivateApps] = useState([]);
  const [loadingClassifications, setLoadingClassifications] = useState(true);

  // Input states for adding custom items
  const [customWhitelistApp, setCustomWhitelistApp] = useState('');
  const [customBlacklistApp, setCustomBlacklistApp] = useState('');
  const [customPrivateSite, setCustomPrivateSite] = useState('');

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const result = await invoke('getAllProjects');
      if (result.success && result.projects) {
        setAvailableProjects(result.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      // Don't show error - just use empty list
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadSettings = async (projectKey = null) => {
    setLoading(true);
    try {
      const result = await invoke('getTrackingSettings', { projectKey });
      if (result.success && result.settings) {
        setSettings(prev => ({
          ...prev,
          ...result.settings
        }));
        setSettingsSource(result.settings.settingsSource || 'organization');
      }
    } catch (err) {
      console.error('Failed to load tracking settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const loadClassifications = async () => {
    setLoadingClassifications(true);
    try {
      // Fetch all classifications from database (no projectKey = org-level)
      const result = await invoke('getClassifications', { projectKey: null });
      if (result.success && result.classifications) {
        // Filter by classification type and match_by = 'process' (for process-based apps)
        const productive = result.classifications
          .filter(c => c.classification === 'productive' && c.match_by === 'process')
          .map(c => ({ name: c.display_name || c.identifier, value: c.identifier.toLowerCase() }));
        
        const nonProductive = result.classifications
          .filter(c => c.classification === 'non_productive' && c.match_by === 'process')
          .map(c => ({ name: c.display_name || c.identifier, value: c.identifier.toLowerCase() }));
        
        // Private sites can be both process and URL-based
        const privateSites = result.classifications
          .filter(c => c.classification === 'private')
          .map(c => ({ name: c.display_name || c.identifier, value: c.identifier.toLowerCase() }));
        
        setProductiveApps(productive);
        setNonProductiveApps(nonProductive);
        setPrivateApps(privateSites);
      }
    } catch (err) {
      console.error('Failed to load classifications:', err);
      // Don't show error to user - just use empty lists
    } finally {
      setLoadingClassifications(false);
    }
  };

  useEffect(() => {
    loadProjects();
    loadSettings(selectedProject);
    loadClassifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload settings when project changes
  useEffect(() => {
    if (!loadingProjects) {
      loadSettings(selectedProject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await invoke('saveTrackingSettings', { 
        settings,
        projectKey: selectedProject 
      });
      if (result.success) {
        const level = selectedProject ? `project ${selectedProject}` : 'organization';
        setMessage({ type: 'success', text: `Timesheet settings saved successfully for ${level}!` });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setMessage({ type: '', text: '' });
    try {
      const result = await invoke('triggerWorklogSync');
      if (result.success) {
        const synced = result.synced || 0;
        const errors = result.errors || 0;
        setMessage({ type: 'success', text: `Worklog sync completed! Synced: ${synced}, Errors: ${errors}` });
      } else {
        setMessage({ type: 'error', text: result.error || 'Sync failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Sync failed: ' + err.message });
    } finally {
      setSyncing(false);
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

      {/* Project Selector - Choose between org-wide or project-specific settings */}
      <section className="settings-section project-selector-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Settings Level</h2>
        </div>
        <div className="section-content">
          <p className="field-description">
            Choose whether to configure settings for the entire organization or for a specific project. 
            Project-specific settings override organization defaults.
          </p>
          <div className="form-group">
            <label>Configuration Level</label>
            {loadingProjects ? (
              <p className="loading-text">Loading projects...</p>
            ) : (
              <select 
                value={selectedProject || ''} 
                onChange={(e) => setSelectedProject(e.target.value || null)}
                className="project-select"
              >
                <option value="">Organization-Wide (Default for all projects)</option>
                {availableProjects.map(project => (
                  <option key={project.key} value={project.key}>
                    {project.name} ({project.key})
                  </option>
                ))}
              </select>
            )}
            {settingsSource && (
              <p className="field-hint">
                {settingsSource === 'project' && selectedProject && (
                  <span style={{color: '#36B37E', fontWeight: 'bold'}}>
                    ✓ Viewing project-specific settings for {selectedProject}
                  </span>
                )}
                {settingsSource === 'organization' && selectedProject && (
                  <span style={{color: '#FF991F'}}>
                    ⚠ No project-specific settings found. Showing organization defaults. Save to create project-specific settings.
                  </span>
                )}
                {settingsSource === 'organization' && !selectedProject && (
                  <span style={{color: '#36B37E', fontWeight: 'bold'}}>
                    ✓ Viewing organization-wide default settings
                  </span>
                )}
                {settingsSource === 'global' && (
                  <span style={{color: '#6B778C'}}>
                    Showing global default settings
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

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

      {/* Productive Applications Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Productive Applications</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.whitelistEnabled}
              onChange={() => handleToggle('whitelistEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Enable Productive Apps</span>
          </label>
        </div>

        {settings.whitelistEnabled && (
          <div className="section-content">
            <p className="field-description">
              Applications classified as productive work apps (managed via Application Classifications)
            </p>

            {/* Applications from Database */}
            <div className="common-apps-container">
              <label className="common-apps-label">Classified Productive Applications</label>
              {loadingClassifications ? (
                <p className="loading-text">Loading classifications...</p>
              ) : productiveApps.length > 0 ? (
                <div className="common-apps-grid">
                  {productiveApps.map(app => (
                    <button
                      key={app.value}
                      className={`app-chip ${settings.whitelistedApps.includes(app.value) ? 'selected' : ''}`}
                      onClick={() => toggleCommonApp('whitelistedApps', app.value)}
                    >
                      {app.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="field-hint">No productive applications classified yet. Add them via Application Classifications page.</p>
              )}
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

            {/* Current Productive Apps List */}
            <div className="current-list">
              <label>Current Productive Apps ({settings.whitelistedApps.length})</label>
              <div className="tags-container">
                {settings.whitelistedApps.length > 0 ? (
                  settings.whitelistedApps.map(app => (
                    <span key={app} className="tag whitelist-tag">
                      {app}
                      <button
                        className="tag-remove"
                        onClick={() => removeFromList('whitelistedApps', app)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="field-hint">No productive apps selected. Use Application Classifications to manage apps.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Non-Productive Applications Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.93 4.93L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Non-Productive Applications</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.blacklistEnabled}
              onChange={() => handleToggle('blacklistEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Enable Non-Productive Apps</span>
          </label>
        </div>

        {settings.blacklistEnabled && (
          <div className="section-content">
            <p className="field-description">
              Applications classified as non-productive (e.g., entertainment, social media - managed via Application Classifications)
            </p>

            {/* Applications from Database */}
            <div className="common-apps-container">
              <label className="common-apps-label">Classified Non-Productive Applications</label>
              {loadingClassifications ? (
                <p className="loading-text">Loading classifications...</p>
              ) : nonProductiveApps.length > 0 ? (
                <div className="common-apps-grid">
                  {nonProductiveApps.map(app => (
                    <button
                      key={app.value}
                      className={`app-chip blacklist-chip ${settings.blacklistedApps.includes(app.value) ? 'selected' : ''}`}
                      onClick={() => toggleCommonApp('blacklistedApps', app.value)}
                    >
                      {app.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="field-hint">No non-productive applications classified yet. Add them via Application Classifications page.</p>
              )}
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

            {/* Current Non-Productive Apps List */}
            <div className="current-list">
              <label>Current Non-Productive Apps ({settings.blacklistedApps.length})</label>
              <div className="tags-container">
                {settings.blacklistedApps.length > 0 ? (
                  settings.blacklistedApps.map(app => (
                    <span key={app} className="tag blacklist-tag">
                      {app}
                      <button
                        className="tag-remove"
                        onClick={() => removeFromList('blacklistedApps', app)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="field-hint">No non-productive apps selected. Use Application Classifications to manage apps.</p>
                )}
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
                <h3>Flag Users for Excessive Non-Productive Activity</h3>
              </div>
              <p className="field-description">
                Set the percentage threshold for weekly non-productive app usage that will flag users for excessive non-work activities.
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
              Websites and applications that should be omitted from tracking (e.g., banking, personal, healthcare - managed via Application Classifications)
            </p>

            {/* Applications from Database */}
            <div className="common-apps-container">
              <label className="common-apps-label">Classified Private Sites/Applications</label>
              {loadingClassifications ? (
                <p className="loading-text">Loading classifications...</p>
              ) : privateApps.length > 0 ? (
                <div className="common-apps-grid">
                  {privateApps.map(app => (
                    <button
                      key={app.value}
                      className={`app-chip private-chip ${settings.privateSites.includes(app.value) ? 'selected' : ''}`}
                      onClick={() => toggleCommonApp('privateSites', app.value)}
                    >
                      {app.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="field-hint">No private sites/applications classified yet. Add them via Application Classifications page.</p>
              )}
            </div>

            {/* Custom Private Site Input */}
            <div className="custom-input-container">
              <label>Add Custom Private Site/Domain</label>
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
              <div className="tags-container">
                {settings.privateSites.length > 0 ? (
                  settings.privateSites.map(site => (
                    <span key={site} className="tag private-tag">
                      {site}
                      <button
                        className="tag-remove"
                        onClick={() => removeFromList('privateSites', site)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="field-hint">No private sites configured. Use Application Classifications to manage private sites.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Jira Worklog Auto-Sync Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Jira Worklog Auto-Sync</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.jiraWorklogSyncEnabled}
              onChange={() => handleToggle('jiraWorklogSyncEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              {settings.jiraWorklogSyncEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        <div className="section-content">
          <p className="field-description">
            When enabled, tracked time from the desktop app is automatically pushed to Jira's native "Time Spent" field as worklogs.
            This sync runs automatically every hour via a scheduled job. One worklog per issue per user is maintained — it will be created on first sync
            and updated on subsequent runs if time has changed.
          </p>
          <p className="field-hint">
            Worklogs will appear in each issue's "Work Log" tab and the "Time Spent" field in the Details panel.
          </p>
          {settings.jiraWorklogSyncEnabled && (
            <button
              className="save-btn"
              onClick={handleSyncNow}
              disabled={syncing}
              style={{ marginTop: '12px', maxWidth: '200px' }}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
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
