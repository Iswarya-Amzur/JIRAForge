import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './ProjectStatusSettings.css';

/**
 * ProjectStatusSettings Component
 * Allows project admins to configure which Jira statuses should be tracked
 * for time tracking in their project.
 * 
 * Features:
 * - Fetches all available Jira statuses
 * - Groups statuses by category (To Do, In Progress, Done)
 * - Allows selecting multiple statuses
 * - Saves settings to Supabase per project
 */
function ProjectStatusSettings({ projectKey, projectName, onSave }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(['In Progress']);
  const [currentSettings, setCurrentSettings] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Load Jira statuses
      const statusResult = await invoke('getJiraStatuses');
      if (statusResult.success && statusResult.statuses) {
        setStatuses(statusResult.statuses);
      } else {
        setMessage({ type: 'error', text: 'Failed to load Jira statuses' });
      }

      // Load existing project settings if projectKey is provided
      if (projectKey) {
        const settingsResult = await invoke('getProjectSettings', { projectKey });
        if (settingsResult.success && settingsResult.settings) {
          setCurrentSettings(settingsResult.settings);
          if (settingsResult.settings.trackedStatuses) {
            setSelectedStatuses(settingsResult.settings.trackedStatuses);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setMessage({ type: 'error', text: 'Failed to load data: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  const handleStatusToggle = (statusName) => {
    setSelectedStatuses(prev => {
      if (prev.includes(statusName)) {
        // Don't allow removing all statuses
        if (prev.length === 1) {
          setMessage({ type: 'warning', text: 'At least one status must be selected' });
          return prev;
        }
        return prev.filter(s => s !== statusName);
      } else {
        return [...prev, statusName];
      }
    });
    setMessage({ type: '', text: '' });
  };

  const handleSelectCategory = (category) => {
    const categoryStatuses = statuses
      .filter(s => s.category === category)
      .map(s => s.name);
    
    // Check if all category statuses are already selected
    const allSelected = categoryStatuses.every(s => selectedStatuses.includes(s));
    
    if (allSelected) {
      // Deselect all from this category (but keep at least one status)
      const remaining = selectedStatuses.filter(s => !categoryStatuses.includes(s));
      if (remaining.length > 0) {
        setSelectedStatuses(remaining);
      } else {
        setMessage({ type: 'warning', text: 'At least one status must be selected' });
      }
    } else {
      // Select all from this category
      const newSelection = [...new Set([...selectedStatuses, ...categoryStatuses])];
      setSelectedStatuses(newSelection);
    }
  };

  const handleSelectAllInProgress = () => {
    const inProgressStatuses = statuses
      .filter(s => s.category === 'In Progress')
      .map(s => s.name);
    setSelectedStatuses(inProgressStatuses);
  };

  const handleSave = async () => {
    if (!projectKey) {
      setMessage({ type: 'error', text: 'Project key is required' });
      return;
    }

    if (selectedStatuses.length === 0) {
      setMessage({ type: 'error', text: 'At least one status must be selected' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await invoke('saveProjectSettings', {
        projectKey,
        projectName: projectName || projectKey,
        trackedStatuses: selectedStatuses
      });

      if (result.success) {
        setMessage({ type: 'success', text: `Settings saved for ${projectKey}` });
        setCurrentSettings({
          ...currentSettings,
          trackedStatuses: selectedStatuses,
          configured: true
        });
        if (onSave) {
          onSave(selectedStatuses);
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!projectKey) return;

    if (!window.confirm('Reset to default settings? This will track only "In Progress" status.')) {
      return;
    }

    setSaving(true);
    try {
      await invoke('deleteProjectSettings', { projectKey });
      setSelectedStatuses(['In Progress']);
      setCurrentSettings(null);
      setMessage({ type: 'success', text: 'Settings reset to default' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reset settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // Group statuses by category
  const groupedStatuses = statuses.reduce((acc, status) => {
    const category = status.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(status);
    return acc;
  }, {});

  // Order categories: In Progress first, then To Do, then Done, then others
  const categoryOrder = ['In Progress', 'To Do', 'Done'];
  const sortedCategories = [
    ...categoryOrder.filter(c => groupedStatuses[c]),
    ...Object.keys(groupedStatuses).filter(c => !categoryOrder.includes(c))
  ];

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'In Progress':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#0065FF" strokeWidth="2"/>
            <path d="M12 6V12L16 14" stroke="#0065FF" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'To Do':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#6B778C" strokeWidth="2"/>
          </svg>
        );
      case 'Done':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#36B37E" strokeWidth="2"/>
            <path d="M8 12L11 15L16 9" stroke="#36B37E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#6B778C" strokeWidth="2"/>
          </svg>
        );
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'In Progress': return '#0065FF';
      case 'To Do': return '#6B778C';
      case 'Done': return '#36B37E';
      default: return '#6B778C';
    }
  };

  if (loading) {
    return (
      <div className="project-status-settings loading">
        <div className="loading-spinner"></div>
        <p>Loading statuses...</p>
      </div>
    );
  }

  // Note: Parent component (TimesheetSettings) already checks admin permissions
  // This component is only rendered for admins

  return (
    <div className="project-status-settings">
      <div className="settings-header">
        <div className="header-content">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Tracked Statuses
            {projectKey && <span className="project-badge">{projectKey}</span>}
          </h3>
          {currentSettings?.configured && (
            <span className="configured-badge">Configured</span>
          )}
        </div>
        <p className="settings-description">
          Select which Jira statuses should be tracked for time tracking. 
          Only issues in these statuses will be fetched for AI matching.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className="quick-action-btn"
          onClick={handleSelectAllInProgress}
          title="Select all In Progress statuses"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Select All "In Progress"
        </button>
        <span className="selected-count">
          {selectedStatuses.length} status{selectedStatuses.length !== 1 ? 'es' : ''} selected
        </span>
      </div>

      {/* Status Categories */}
      <div className="status-categories">
        {sortedCategories.map(category => (
          <div key={category} className="status-category">
            <div className="category-header">
              <div className="category-title">
                {getCategoryIcon(category)}
                <span style={{ color: getCategoryColor(category) }}>{category}</span>
                <span className="category-count">
                  ({groupedStatuses[category].length})
                </span>
              </div>
              <button
                className="select-all-btn"
                onClick={() => handleSelectCategory(category)}
              >
                {groupedStatuses[category].every(s => selectedStatuses.includes(s.name))
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>
            <div className="status-list">
              {groupedStatuses[category].map(status => (
                <label 
                  key={status.id} 
                  className={`status-item ${selectedStatuses.includes(status.name) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status.name)}
                    onChange={() => handleStatusToggle(status.name)}
                  />
                  <span className="status-checkbox">
                    {selectedStatuses.includes(status.name) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="status-name">{status.name}</span>
                  {status.description && (
                    <span className="status-description" title={status.description}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="#6B778C" strokeWidth="2"/>
                        <path d="M12 16V12" stroke="#6B778C" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M12 8H12.01" stroke="#6B778C" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Preview */}
      <div className="selected-preview">
        <h4>Currently Selected:</h4>
        <div className="selected-tags">
          {selectedStatuses.map(status => (
            <span key={status} className="selected-tag">
              {status}
              <button
                className="remove-tag"
                onClick={() => handleStatusToggle(status)}
                disabled={selectedStatuses.length === 1}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {message.type === 'error' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
          {message.type === 'warning' && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.9011 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.9011 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        {currentSettings?.configured && (
          <button
            className="reset-btn"
            onClick={handleReset}
            disabled={saving}
          >
            Reset to Default
          </button>
        )}
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={saving || selectedStatuses.length === 0}
        >
          {saving ? (
            <>
              <span className="spinner"></span>
              Saving...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16L21 8V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 21V13H7V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 3V8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="info-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="#0065FF" strokeWidth="2"/>
          <path d="M12 16V12" stroke="#0065FF" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 8H12.01" stroke="#0065FF" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <p>
          <strong>How it works:</strong> The desktop app will fetch issues in the selected statuses 
          for AI matching. Fewer statuses = more accurate AI matching. 
          Typically, tracking "In Progress" statuses is recommended.
        </p>
      </div>
    </div>
  );
}

export default ProjectStatusSettings;
