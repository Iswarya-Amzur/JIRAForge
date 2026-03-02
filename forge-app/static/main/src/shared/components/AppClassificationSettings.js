import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@forge/bridge';
import './AppClassificationSettings.css';
import { searchAppAliases } from './appAliasDatabase';

const DEFAULT_VISIBLE_APPS = 24;

/**
 * Normalize an app identifier to a canonical form for deduplication.
 * Strips file extensions, removes separators, and lowercases.
 * e.g. "code.exe" -> "code", "Visual Studio Code" -> "visualstudiocode",
 *      "vs-code" -> "vscode"
 */
function normalizeAppIdentifier(identifier) {
  return identifier
    .toLowerCase()
    .replace(/\.(exe|app|dmg|msi|deb|rpm|snap|flatpak)$/i, '')
    .replace(/[\s\-_.]+/g, '');
}

/**
 * Well-known app aliases: maps normalized forms to a single canonical name.
 * This handles cases like "code", "vscode", "visualstudiocode" all being VS Code.
 */
const APP_ALIASES = {
  'code': 'vscode',
  'visualstudiocode': 'vscode',
  'vscode': 'vscode',
  'cursor': 'cursor',
  'cursoride': 'cursor',
  'zoom': 'zoom',
  'zoomus': 'zoom',
  'zoomworkplace': 'zoom',
  'slack': 'slack',
  'teams': 'teams',
  'microsoftteams': 'teams',
  'msteams': 'teams',
  'chrome': 'chrome',
  'googlechrome': 'chrome',
  'firefox': 'firefox',
  'mozillafirefox': 'firefox',
  'edge': 'edge',
  'msedge': 'edge',
  'microsoftedge': 'edge',
  'safari': 'safari',
  'brave': 'brave',
  'bravebrowser': 'brave',
  'opera': 'opera',
  'operabrowser': 'opera',
  'postman': 'postman',
  'figma': 'figma',
  'notion': 'notion',
  'discord': 'discord',
  'spotify': 'spotify',
  'telegram': 'telegram',
  'telegramdesktop': 'telegram',
  'whatsapp': 'whatsapp',
  'whatsappdesktop': 'whatsapp',
  'skype': 'skype',
  'outlook': 'outlook',
  'microsoftoutlook': 'outlook',
  'thunderbird': 'thunderbird',
  'sublimetext': 'sublimetext',
  'sublime': 'sublimetext',
  'notepadplusplus': 'notepadplusplus',
  'notepad++': 'notepadplusplus',
  'intellijidea': 'intellijidea',
  'intellij': 'intellijidea',
  'webstorm': 'webstorm',
  'pycharm': 'pycharm',
  'androidstudio': 'androidstudio',
  'xcode': 'xcode',
  'terminal': 'terminal',
  'iterm': 'iterm',
  'iterm2': 'iterm',
  'windowsterminal': 'windowsterminal',
  'wt': 'windowsterminal',
  'powershell': 'powershell',
  'gitkraken': 'gitkraken',
  'sourcetree': 'sourcetree',
};

function getCanonicalKey(identifier) {
  const normalized = normalizeAppIdentifier(identifier);
  return APP_ALIASES[normalized] || normalized;
}

/**
 * Deduplicate an array of classification entries that refer to the same app.
 * Prefers entries with a display_name, and picks the best display name among duplicates.
 */
function deduplicateClassifications(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const canonical = getCanonicalKey(entry.identifier);
    const existing = grouped.get(canonical);
    if (!existing) {
      grouped.set(canonical, entry);
    } else {
      const existingHasDisplay = existing.display_name && existing.display_name !== existing.identifier;
      const newHasDisplay = entry.display_name && entry.display_name !== entry.identifier;
      if (!existingHasDisplay && newHasDisplay) {
        grouped.set(canonical, entry);
      }
    }
  }
  return Array.from(grouped.values());
}

function AppClassificationSettings({ projectKey }) {
  const [settings, setSettings] = useState({
    productiveAppsEnabled: true,
    productiveAppsSelected: [],
    nonProductiveAppsEnabled: true,
    nonProductiveAppsSelected: [],
    nonWorkThresholdPercent: 30,
    flagExcessiveNonWork: true,
    privateSitesEnabled: true,
    privateSites: [],
  });

  const [productiveApps, setProductiveApps] = useState([]);
  const [nonProductiveApps, setNonProductiveApps] = useState([]);
  const [privateApps, setPrivateApps] = useState([]);
  const [loadingClassifications, setLoadingClassifications] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingUnknownApps, setLoadingUnknownApps] = useState(false);
  const [unknownApps, setUnknownApps] = useState([]);
  const [savingUnknownApp, setSavingUnknownApp] = useState({});

  const [productiveSearch, setProductiveSearch] = useState('');
  const [nonProductiveSearch, setNonProductiveSearch] = useState('');
  const [privateSearch, setPrivateSearch] = useState('');
  const [productiveVisibleCount, setProductiveVisibleCount] = useState(DEFAULT_VISIBLE_APPS);
  const [nonProductiveVisibleCount, setNonProductiveVisibleCount] = useState(DEFAULT_VISIBLE_APPS);
  const [privateVisibleCount, setPrivateVisibleCount] = useState(DEFAULT_VISIBLE_APPS);

  const [message, setMessage] = useState({ type: '', text: '' });

  // State for saving alias selections
  const [savingAlias, setSavingAlias] = useState({});

  // Store the full tracking settings so we can merge when saving
  const [fullTrackingSettings, setFullTrackingSettings] = useState(null);

  /**
   * Normalize a saved app list to canonical keys and deduplicate.
   * Handles legacy raw values like "code.exe" → "vscode".
   */
  const normalizeAppList = (apps) => {
    if (!apps || !Array.isArray(apps)) return [];
    const seen = new Set();
    const result = [];
    for (const app of apps) {
      const canonical = getCanonicalKey(app);
      if (!seen.has(canonical)) {
        seen.add(canonical);
        // Preserve original identifier for runtime matching (e.g., code.exe).
        result.push(app);
      }
    }
    return result;
  };

  const loadSavedSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const result = await invoke('getTrackingSettings', { projectKey: projectKey || null });
      if (result.success && result.settings) {
        setFullTrackingSettings(result.settings);
        setSettings(prev => ({
          ...prev,
          productiveAppsEnabled:
            result.settings.productiveAppsEnabled ??
            result.settings.whitelistEnabled ??
            prev.productiveAppsEnabled,
          productiveAppsSelected: normalizeAppList(
            result.settings.productiveAppsSelected ?? result.settings.whitelistedApps
          ),
          nonProductiveAppsEnabled:
            result.settings.nonProductiveAppsEnabled ??
            result.settings.blacklistEnabled ??
            prev.nonProductiveAppsEnabled,
          nonProductiveAppsSelected: normalizeAppList(
            result.settings.nonProductiveAppsSelected ?? result.settings.blacklistedApps
          ),
          nonWorkThresholdPercent: result.settings.nonWorkThresholdPercent ?? prev.nonWorkThresholdPercent,
          flagExcessiveNonWork: result.settings.flagExcessiveNonWork ?? prev.flagExcessiveNonWork,
          privateSitesEnabled: result.settings.privateSitesEnabled ?? prev.privateSitesEnabled,
          privateSites: normalizeAppList(result.settings.privateSites),
        }));
      }
    } catch (err) {
      console.error('Failed to load saved settings:', err);
    } finally {
      setLoadingSettings(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  const loadClassifications = useCallback(async () => {
    setLoadingClassifications(true);
    try {
      const result = await invoke('getClassifications', { projectKey: projectKey || null });
      if (result.success && result.classifications) {
        // Show one unified searchable app catalog in all three sections.
        const dedupedCatalog = deduplicateClassifications(result.classifications)
          .map(c => ({ name: c.display_name || c.identifier, value: c.identifier }));

        setProductiveApps(dedupedCatalog);
        setNonProductiveApps(dedupedCatalog);
        setPrivateApps(dedupedCatalog);
      }
    } catch (err) {
      console.error('Failed to load classifications:', err);
    } finally {
      setLoadingClassifications(false);
    }
  }, [projectKey]);

  const loadUnknownApps = useCallback(async () => {
    setLoadingUnknownApps(true);
    try {
      const result = await invoke('getUnknownApps', { projectKey: projectKey || null });
      if (result.success && Array.isArray(result.unknownApps)) {
        setUnknownApps(result.unknownApps);
      } else {
        setUnknownApps([]);
      }
    } catch (err) {
      console.error('Failed to load unknown apps:', err);
      setUnknownApps([]);
    } finally {
      setLoadingUnknownApps(false);
    }
  }, [projectKey]);

  useEffect(() => {
    loadClassifications();
    loadSavedSettings();
    loadUnknownApps();
  }, [loadClassifications, loadSavedSettings, loadUnknownApps]);

  const saveSettings = useCallback(async (updatedClassificationSettings) => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      // Merge classification changes with the full tracking settings to avoid
      // overwriting unrelated fields (screenshot interval, tracking mode, etc.)
      const mergedSettings = {
        ...(fullTrackingSettings || {}),
        ...updatedClassificationSettings,
      };
      const persistenceSettings = {
        ...mergedSettings,
        // Keep persistence compatible with existing backend/storage schema.
        whitelistEnabled: mergedSettings.productiveAppsEnabled,
        whitelistedApps: mergedSettings.productiveAppsSelected || [],
        blacklistEnabled: mergedSettings.nonProductiveAppsEnabled,
        blacklistedApps: mergedSettings.nonProductiveAppsSelected || [],
      };

      const result = await invoke('saveTrackingSettings', {
        settings: persistenceSettings,
        projectKey: projectKey || null
      });
      if (result.success) {
        setMessage({ type: 'success', text: 'Application settings saved.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings.' });
      }
    } catch (err) {
      console.error('Failed to save app classification settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings: ' + err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  }, [projectKey, fullTrackingSettings]);

  const handleToggle = (field) => {
    setSettings(prev => {
      const updated = { ...prev, [field]: !prev[field] };
      saveSettings(updated);
      return updated;
    });
  };

  const handleChange = (field, value) => {
    setSettings(prev => {
      const updated = { ...prev, [field]: value };
      saveSettings(updated);
      return updated;
    });
  };

  const removeFromList = (listField, value) => {
    setSettings(prev => {
      const updated = { ...prev, [listField]: prev[listField].filter(item => item !== value) };
      saveSettings(updated);
      return updated;
    });
  };

  const toggleCommonApp = (listField, value) => {
    setSettings(prev => {
      const isSelected = prev[listField].includes(value);
      const classificationLists = ['productiveAppsSelected', 'nonProductiveAppsSelected', 'privateSites'];
      const updated = { ...prev };

      if (isSelected) {
        updated[listField] = prev[listField].filter(item => item !== value);
      } else {
        // Keep one app in exactly one classification bucket.
        for (const field of classificationLists) {
          updated[field] = (updated[field] || []).filter(item => item !== value);
        }
        updated[listField] = [...(updated[listField] || []), value];
      }

      saveSettings(updated);
      return updated;
    });
  };

  const getThresholdColorClass = (value) => {
    if (value <= 30) return 'threshold-normal';
    if (value <= 50) return 'threshold-moderate';
    return 'threshold-high';
  };

  const filterAppsBySearch = (apps, query) => {
    if (!query.trim()) return apps;
    const q = query.trim().toLowerCase();
    return apps.filter(app =>
      app.name.toLowerCase().includes(q) || app.value.toLowerCase().includes(q)
    );
  };

  const filteredProductiveApps = filterAppsBySearch(productiveApps, productiveSearch);
  const filteredNonProductiveApps = filterAppsBySearch(nonProductiveApps, nonProductiveSearch);
  const filteredPrivateApps = filterAppsBySearch(privateApps, privateSearch);

  const visibleProductiveApps = filteredProductiveApps.slice(0, productiveVisibleCount);
  const visibleNonProductiveApps = filteredNonProductiveApps.slice(0, nonProductiveVisibleCount);
  const visiblePrivateApps = filteredPrivateApps.slice(0, privateVisibleCount);

  const classifyUnknownApp = async (unknownApp, classification) => {
    const appId = unknownApp.applicationName;
    setSavingUnknownApp(prev => ({ ...prev, [appId]: true }));
    setMessage({ type: '', text: '' });

    try {
      const result = await invoke('saveClassification', {
        classification: {
          identifier: unknownApp.applicationName,
          displayName: unknownApp.applicationName,
          classification,
          matchBy: 'process',
        },
        projectKey: projectKey || null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save classification');
      }

      setMessage({
        type: 'success',
        text: `Saved classification for ${unknownApp.applicationName} as ${classification.replace('_', ' ')}. Updated ${result.updatedUnknownRecords ?? 0} unknown activity records.`,
      });

      await Promise.all([loadUnknownApps(), loadClassifications()]);
    } catch (err) {
      console.error('Failed to classify unknown app:', err);
      setMessage({
        type: 'error',
        text: `Failed to classify ${unknownApp.applicationName}: ${err.message}`,
      });
    } finally {
      setSavingUnknownApp(prev => ({ ...prev, [appId]: false }));
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  /**
   * Add an application from alias database to classifications
   * @param {string} identifier - The identifier to save (e.g., 'code.exe')
   * @param {string} displayName - Human readable name
   * @param {string} classification - 'productive', 'non_productive', or 'private'
   * @param {string} listField - The state field to add to after saving
   */
  const addAppFromAlias = async (identifier, displayName, classification, listField) => {
    const aliasKey = `${identifier}-${classification}`;
    setSavingAlias(prev => ({ ...prev, [aliasKey]: true }));
    setMessage({ type: '', text: '' });

    try {
      const result = await invoke('saveClassification', {
        classification: {
          identifier: identifier,
          displayName: displayName,
          classification: classification,
          matchBy: 'process',
        },
        projectKey: projectKey || null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save classification');
      }

      setMessage({
        type: 'success',
        text: `Added "${displayName}" (${identifier}) as ${classification.replace('_', ' ')}.`,
      });

      // Clear the search and reload classifications
      if (listField === 'productiveAppsSelected') {
        setProductiveSearch('');
      } else if (listField === 'nonProductiveAppsSelected') {
        setNonProductiveSearch('');
      } else if (listField === 'privateSites') {
        setPrivateSearch('');
      }

      // Reload classifications to include the new one
      await loadClassifications();

      // Auto-select the newly added app
      setSettings(prev => {
        const classificationLists = ['productiveAppsSelected', 'nonProductiveAppsSelected', 'privateSites'];
        const updated = { ...prev };
        // Remove from other lists first
        for (const field of classificationLists) {
          updated[field] = (updated[field] || []).filter(item => item !== identifier);
        }
        // Add to the target list
        updated[listField] = [...(updated[listField] || []), identifier];
        saveSettings(updated);
        return updated;
      });

    } catch (err) {
      console.error('Failed to add app from alias:', err);
      setMessage({
        type: 'error',
        text: `Failed to add ${displayName}: ${err.message}`,
      });
    } finally {
      setSavingAlias(prev => ({ ...prev, [aliasKey]: false }));
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }
  };

  // Get alias suggestions when search doesn't have an EXACT match in existing classifications
  // Show aliases as "Add new" option even if there are partial matches
  const getAliasSuggestionsForSearch = (searchQuery, filteredApps, allApps) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    
    const query = searchQuery.trim().toLowerCase();
    
    // Check if there's an exact match (identifier or display name matches query exactly)
    const hasExactMatch = filteredApps.some(app => 
      app.name.toLowerCase() === query || 
      app.value.toLowerCase() === query ||
      app.value.toLowerCase().replace(/\.(exe|app)$/i, '') === query
    );
    
    // If there's an exact match, no need for aliases
    if (hasExactMatch) return [];
    
    // Get alias suggestions
    const aliases = searchAppAliases(searchQuery);
    
    // Filter out aliases that already have their identifiers in the classification DB
    const existingIdentifiers = new Set(allApps.map(app => app.value.toLowerCase()));
    return aliases.filter(alias => {
      // Keep alias if at least one of its identifiers is NOT in the DB
      return alias.identifiers.some(id => !existingIdentifiers.has(id.toLowerCase()));
    });
  };

  const productiveAliasSuggestions = getAliasSuggestionsForSearch(productiveSearch, filteredProductiveApps, productiveApps);
  const nonProductiveAliasSuggestions = getAliasSuggestionsForSearch(nonProductiveSearch, filteredNonProductiveApps, nonProductiveApps);
  const privateAliasSuggestions = getAliasSuggestionsForSearch(privateSearch, filteredPrivateApps, privateApps);

  if (loadingSettings || loadingClassifications) {
    return (
      <div className="app-classification-settings loading">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading application settings...</p>
      </div>
    );
  }

  return (
    <div className="app-classification-settings">
      {/* Productive Applications Section */}
      <section className="classification-section">
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
              checked={settings.productiveAppsEnabled}
              onChange={() => handleToggle('productiveAppsEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Enable Productive Apps</span>
          </label>
        </div>

        {settings.productiveAppsEnabled && (
          <div className="section-content">
            <p className="field-description">
              Applications classified as productive work apps (managed via Application Classifications)
            </p>

            <div className="common-apps-container">
              <label className="common-apps-label">Classified Productive Applications</label>
              <div className="classification-search-row">
                <input
                  type="text"
                  className="classification-search-input"
                  placeholder="Search productive apps..."
                  value={productiveSearch}
                  onChange={(e) => {
                    setProductiveSearch(e.target.value);
                    setProductiveVisibleCount(DEFAULT_VISIBLE_APPS);
                  }}
                />
                <span className="classification-count-text">
                  {productiveSearch.trim()
                    ? `${filteredProductiveApps.length} match${filteredProductiveApps.length === 1 ? '' : 'es'}`
                    : 'Type to search'}
                </span>
              </div>
              {loadingClassifications ? (
                <p className="loading-text">Loading classifications...</p>
              ) : !productiveSearch.trim() ? (
                <p className="field-hint">Use search to find and select productive apps.</p>
              ) : (
                <>
                  {/* Existing classifications that match */}
                  {filteredProductiveApps.length > 0 && (
                    <div className="common-apps-grid">
                      {visibleProductiveApps.map(app => (
                        <button
                          key={app.value}
                          className={`app-chip ${settings.productiveAppsSelected.includes(app.value) ? 'selected' : ''}`}
                          onClick={() => toggleCommonApp('productiveAppsSelected', app.value)}
                        >
                          {app.name}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Alias suggestions - show when aliases available */}
                  {productiveAliasSuggestions.length > 0 && (
                    <div className="alias-suggestions">
                      <p className="alias-hint">
                        {filteredProductiveApps.length > 0 
                          ? 'Add a new application variant:' 
                          : 'App not found in classifications. Select an alias to add it:'}
                      </p>
                      {productiveAliasSuggestions.slice(0, 5).map(alias => (
                        <div key={alias.canonicalKey} className="alias-suggestion-item">
                          <div className="alias-header">
                            <span className="alias-name">{alias.displayName}</span>
                            <span className="alias-category">{alias.category}</span>
                          </div>
                          <div className="alias-identifiers">
                            {alias.identifiers.map(id => {
                              const isSaving = savingAlias[`${id}-productive`];
                              return (
                                <button
                                  key={id}
                                  className="alias-identifier-btn"
                                  disabled={isSaving}
                                  onClick={() => addAppFromAlias(id, alias.displayName, 'productive', 'productiveAppsSelected')}
                                >
                                  {isSaving ? 'Adding...' : id}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* No matches - offer to add custom app */}
                  {filteredProductiveApps.length === 0 && productiveAliasSuggestions.length === 0 && productiveSearch.trim().length >= 2 && (
                    <div className="custom-app-add">
                      <p className="field-hint">No matching applications found.</p>
                      <button
                        className="add-custom-btn productive"
                        disabled={savingAlias[`${productiveSearch.trim()}-productive`]}
                        onClick={() => addAppFromAlias(productiveSearch.trim(), productiveSearch.trim(), 'productive', 'productiveAppsSelected')}
                      >
                        {savingAlias[`${productiveSearch.trim()}-productive`] ? 'Adding...' : `Add "${productiveSearch.trim()}" as productive app`}
                      </button>
                    </div>
                  )}
                </>
              )}
              {productiveSearch.trim() && filteredProductiveApps.length > DEFAULT_VISIBLE_APPS && (
                <button
                  className="load-more-button"
                  onClick={() => {
                    if (productiveVisibleCount >= filteredProductiveApps.length) {
                      setProductiveVisibleCount(DEFAULT_VISIBLE_APPS);
                    } else {
                      setProductiveVisibleCount(prev => prev + DEFAULT_VISIBLE_APPS);
                    }
                  }}
                >
                  {productiveVisibleCount >= filteredProductiveApps.length
                    ? 'Show Less'
                    : `Show More (${filteredProductiveApps.length - productiveVisibleCount} remaining)`}
                </button>
              )}
            </div>

            <div className="current-list">
              <label>Current Productive Apps ({settings.productiveAppsSelected.length})</label>
              <div className="tags-container">
                {settings.productiveAppsSelected.length > 0 ? (
                  settings.productiveAppsSelected.map(app => (
                    <span key={app} className="tag productive-tag">
                      {app}
                      <button
                        className="tag-remove"
                        onClick={() => removeFromList('productiveAppsSelected', app)}
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

      {/* Unknown Apps Review Section */}
      <section className="classification-section">
        <div className="section-header">
          <div className="section-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
          <h2>Unknown Apps Review</h2>
        </div>

        <div className="section-content">
          <p className="field-description">
            Apps that are still unclassified in activity records. Project admins can classify them here.
          </p>

          {loadingUnknownApps ? (
            <p className="loading-text">Loading unknown apps...</p>
          ) : unknownApps.length === 0 ? (
            <p className="field-hint">No unknown apps pending review.</p>
          ) : (
            <div className="current-list">
              <label>Pending Unknown Apps ({unknownApps.length})</label>
              <div className="unknown-apps-list">
                {unknownApps.map((app) => {
                  const appId = app.applicationName;
                  const isSaving = !!savingUnknownApp[appId];

                  return (
                    <div key={appId} className="unknown-app-card">
                      <div className="unknown-app-info">
                        <div className="unknown-app-name">{app.applicationName}</div>
                        {app.lastWindowTitle && (
                          <div className="unknown-app-meta">Last: {app.lastWindowTitle}</div>
                        )}
                      </div>
                      <div className="unknown-app-actions">
                        <button
                          className="unknown-app-action-btn productive-btn"
                          disabled={isSaving}
                          onClick={() => classifyUnknownApp(app, 'productive')}
                        >
                          {isSaving ? '...' : 'Productive'}
                        </button>
                        <button
                          className="unknown-app-action-btn non-productive-btn"
                          disabled={isSaving}
                          onClick={() => classifyUnknownApp(app, 'non_productive')}
                        >
                          {isSaving ? '...' : 'Non-Prod'}
                        </button>
                        <button
                          className="unknown-app-action-btn private-btn"
                          disabled={isSaving}
                          onClick={() => classifyUnknownApp(app, 'private')}
                        >
                          {isSaving ? '...' : 'Private'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Non-Productive Applications Section */}
      <section className="classification-section">
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
              checked={settings.nonProductiveAppsEnabled}
              onChange={() => handleToggle('nonProductiveAppsEnabled')}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Enable Non-Productive Apps</span>
          </label>
        </div>

        {settings.nonProductiveAppsEnabled && (
          <div className="section-content">
            <p className="field-description">
              Applications classified as non-productive (e.g., entertainment, social media - managed via Application Classifications)
            </p>

            <div className="common-apps-container">
              <label className="common-apps-label">Classified Non-Productive Applications</label>
              <div className="classification-search-row">
                <input
                  type="text"
                  className="classification-search-input"
                  placeholder="Search non-productive apps..."
                  value={nonProductiveSearch}
                  onChange={(e) => {
                    setNonProductiveSearch(e.target.value);
                    setNonProductiveVisibleCount(DEFAULT_VISIBLE_APPS);
                  }}
                />
                <span className="classification-count-text">
                  {nonProductiveSearch.trim()
                    ? `${filteredNonProductiveApps.length} match${filteredNonProductiveApps.length === 1 ? '' : 'es'}`
                    : 'Type to search'}
                </span>
              </div>
              {loadingClassifications ? (
                <p className="loading-text">Loading classifications...</p>
              ) : !nonProductiveSearch.trim() ? (
                <p className="field-hint">Use search to find and select non-productive apps.</p>
              ) : (
                <>
                  {/* Existing classifications that match */}
                  {filteredNonProductiveApps.length > 0 && (
                    <div className="common-apps-grid">
                      {visibleNonProductiveApps.map(app => (
                        <button
                          key={app.value}
                          className={`app-chip non-productive-chip ${settings.nonProductiveAppsSelected.includes(app.value) ? 'selected' : ''}`}
                          onClick={() => toggleCommonApp('nonProductiveAppsSelected', app.value)}
                        >
                          {app.name}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Alias suggestions - show when aliases available */}
                  {nonProductiveAliasSuggestions.length > 0 && (
                    <div className="alias-suggestions">
                      <p className="alias-hint">
                        {filteredNonProductiveApps.length > 0 
                          ? 'Add a new application variant:' 
                          : 'App not found in classifications. Select an alias to add it:'}
                      </p>
                      {nonProductiveAliasSuggestions.slice(0, 5).map(alias => (
                        <div key={alias.canonicalKey} className="alias-suggestion-item">
                          <div className="alias-header">
                            <span className="alias-name">{alias.displayName}</span>
                            <span className="alias-category">{alias.category}</span>
                          </div>
                          <div className="alias-identifiers">
                            {alias.identifiers.map(id => {
                              const isSaving = savingAlias[`${id}-non_productive`];
                              return (
                                <button
                                  key={id}
                                  className="alias-identifier-btn non-productive"
                                  disabled={isSaving}
                                  onClick={() => addAppFromAlias(id, alias.displayName, 'non_productive', 'nonProductiveAppsSelected')}
                                >
                                  {isSaving ? 'Adding...' : id}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* No matches - offer to add custom app */}
                  {filteredNonProductiveApps.length === 0 && nonProductiveAliasSuggestions.length === 0 && nonProductiveSearch.trim().length >= 2 && (
                    <div className="custom-app-add">
                      <p className="field-hint">No matching applications found.</p>
                      <button
                        className="add-custom-btn non-productive"
                        disabled={savingAlias[`${nonProductiveSearch.trim()}-non_productive`]}
                        onClick={() => addAppFromAlias(nonProductiveSearch.trim(), nonProductiveSearch.trim(), 'non_productive', 'nonProductiveAppsSelected')}
                      >
                        {savingAlias[`${nonProductiveSearch.trim()}-non_productive`] ? 'Adding...' : `Add "${nonProductiveSearch.trim()}" as non-productive app`}
                      </button>
                    </div>
                  )}
                </>
              )}
              {nonProductiveSearch.trim() && filteredNonProductiveApps.length > DEFAULT_VISIBLE_APPS && (
                <button
                  className="load-more-button"
                  onClick={() => {
                    if (nonProductiveVisibleCount >= filteredNonProductiveApps.length) {
                      setNonProductiveVisibleCount(DEFAULT_VISIBLE_APPS);
                    } else {
                      setNonProductiveVisibleCount(prev => prev + DEFAULT_VISIBLE_APPS);
                    }
                  }}
                >
                  {nonProductiveVisibleCount >= filteredNonProductiveApps.length
                    ? 'Show Less'
                    : `Show More (${filteredNonProductiveApps.length - nonProductiveVisibleCount} remaining)`}
                </button>
              )}
            </div>

            <div className="current-list">
              <label>Current Non-Productive Apps ({settings.nonProductiveAppsSelected.length})</label>
              <div className="tags-container">
                {settings.nonProductiveAppsSelected.length > 0 ? (
                  settings.nonProductiveAppsSelected.map(app => (
                    <span key={app} className="tag non-productive-tag">
                      {app}
                      <button
                        className="tag-remove"
                        onClick={() => removeFromList('nonProductiveAppsSelected', app)}
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
      <section className="classification-section">
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

            <div className="common-apps-container">
              <label className="common-apps-label">Classified Private Sites/Applications</label>
              <div className="classification-search-row">
                <input
                  type="text"
                  className="classification-search-input"
                  placeholder="Search private apps/sites..."
                  value={privateSearch}
                  onChange={(e) => {
                    setPrivateSearch(e.target.value);
                    setPrivateVisibleCount(DEFAULT_VISIBLE_APPS);
                  }}
                />
                <span className="classification-count-text">
                  {privateSearch.trim()
                    ? `${filteredPrivateApps.length} match${filteredPrivateApps.length === 1 ? '' : 'es'}`
                    : 'Type to search'}
                </span>
              </div>
              {loadingClassifications ? (
                <p className="loading-text">Loading classifications...</p>
              ) : !privateSearch.trim() ? (
                <p className="field-hint">Use search to find and select private apps/sites.</p>
              ) : filteredPrivateApps.length > 0 ? (
                <>
                  {/* Existing classifications that match */}
                  <div className="common-apps-grid">
                    {visiblePrivateApps.map(app => (
                      <button
                        key={app.value}
                        className={`app-chip private-chip ${settings.privateSites.includes(app.value) ? 'selected' : ''}`}
                        onClick={() => toggleCommonApp('privateSites', app.value)}
                      >
                        {app.name}
                      </button>
                    ))}
                  </div>
                  
                  {/* Alias suggestions - show when aliases available */}
                  {privateAliasSuggestions.length > 0 && (
                    <div className="alias-suggestions">
                      <p className="alias-hint">Add a new application variant:</p>
                      {privateAliasSuggestions.slice(0, 5).map(alias => (
                        <div key={alias.canonicalKey} className="alias-suggestion-item">
                          <div className="alias-header">
                            <span className="alias-name">{alias.displayName}</span>
                            <span className="alias-category">{alias.category}</span>
                          </div>
                          <div className="alias-identifiers">
                            {alias.identifiers.map(id => {
                              const isSaving = savingAlias[`${id}-private`];
                              return (
                                <button
                                  key={id}
                                  className="alias-identifier-btn private"
                                  disabled={isSaving}
                                  onClick={() => addAppFromAlias(id, alias.displayName, 'private', 'privateSites')}
                                >
                                  {isSaving ? 'Adding...' : id}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : privateAliasSuggestions.length > 0 ? (
                <div className="alias-suggestions">
                  <p className="alias-hint">App not found in classifications. Select an alias to add it:</p>
                  {privateAliasSuggestions.slice(0, 5).map(alias => (
                    <div key={alias.canonicalKey} className="alias-suggestion-item">
                      <div className="alias-header">
                        <span className="alias-name">{alias.displayName}</span>
                        <span className="alias-category">{alias.category}</span>
                      </div>
                      <div className="alias-identifiers">
                        {alias.identifiers.map(id => {
                          const isSaving = savingAlias[`${id}-private`];
                          return (
                            <button
                              key={id}
                              className="alias-identifier-btn private"
                              disabled={isSaving}
                              onClick={() => addAppFromAlias(id, alias.displayName, 'private', 'privateSites')}
                            >
                              {isSaving ? 'Adding...' : id}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="custom-app-add">
                  <p className="field-hint">No matching applications found.</p>
                  {privateSearch.trim().length >= 2 && (
                    <button
                      className="add-custom-btn private"
                      disabled={savingAlias[`${privateSearch.trim()}-private`]}
                      onClick={() => addAppFromAlias(privateSearch.trim(), privateSearch.trim(), 'private', 'privateSites')}
                    >
                      {savingAlias[`${privateSearch.trim()}-private`] ? 'Adding...' : `Add "${privateSearch.trim()}" as private app`}
                    </button>
                  )}
                </div>
              )}
              {privateSearch.trim() && filteredPrivateApps.length > DEFAULT_VISIBLE_APPS && (
                <button
                  className="load-more-button"
                  onClick={() => {
                    if (privateVisibleCount >= filteredPrivateApps.length) {
                      setPrivateVisibleCount(DEFAULT_VISIBLE_APPS);
                    } else {
                      setPrivateVisibleCount(prev => prev + DEFAULT_VISIBLE_APPS);
                    }
                  }}
                >
                  {privateVisibleCount >= filteredPrivateApps.length
                    ? 'Show Less'
                    : `Show More (${filteredPrivateApps.length - privateVisibleCount} remaining)`}
                </button>
              )}
            </div>

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

      {/* Save Status */}
      {saving && (
        <div className="message info">
          Saving...
        </div>
      )}
      {message.text && !saving && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

export default AppClassificationSettings;