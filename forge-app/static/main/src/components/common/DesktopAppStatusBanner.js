import React, { useState, useEffect } from 'react';
import { invoke, router } from '@forge/bridge';

/**
 * Desktop App Status Banner Component
 * Shows banners for:
 * - Desktop App not installed
 * - Desktop App inactive/logged out
 * - Update available (new version)
 */
function DesktopAppStatusBanner({ downloadUrl: fallbackDownloadUrl = 'https://your-download-url.com' }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [alreadyShownToday, setAlreadyShownToday] = useState(false);

  // Check if banner was already shown today
  useEffect(() => {
    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('desktopAppBannerLastShown');
    if (lastShown === today) {
      setAlreadyShownToday(true);
    }
    
    // Check if update was dismissed for this version
    const dismissedVersion = localStorage.getItem('desktopAppUpdateDismissedVersion');
    if (dismissedVersion) {
      setUpdateDismissed(true);
    }
  }, []);

  useEffect(() => {
    checkDesktopAppStatus();
  }, []);

  const checkDesktopAppStatus = async () => {
    try {
      const result = await invoke('getDesktopAppStatus');
      if (result.success) {
        setStatus(result);
        
        // If we have a new version different from what was dismissed, show again
        const dismissedVersion = localStorage.getItem('desktopAppUpdateDismissedVersion');
        if (result.latestVersion && dismissedVersion !== result.latestVersion) {
          setUpdateDismissed(false);
        }
      }
    } catch (error) {
      console.error('Error checking desktop app status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get the download URL (from API response or fallback)
  const getDownloadUrl = () => {
    return status?.downloadUrl || fallbackDownloadUrl;
  };

  // Handle download click
  const handleDownloadClick = () => {
    localStorage.setItem('desktopAppBannerLastShown', new Date().toDateString());
    router.open(getDownloadUrl());
  };

  // Dismiss the update banner for this version
  const dismissUpdate = () => {
    if (status?.latestVersion) {
      localStorage.setItem('desktopAppUpdateDismissedVersion', status.latestVersion);
    }
    setUpdateDismissed(true);
  };

  // Don't show anything while loading
  if (loading) {
    return null;
  }

  // Don't show on weekends (Saturday = 6, Sunday = 0)
  const today = new Date().getDay();
  if (today === 0 || today === 6) {
    return null;
  }

  // PRIORITY 1: Show update available banner (even if app is active)
  if (status?.updateAvailable && !updateDismissed) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
        borderLeft: '4px solid #2196F3',
        borderRadius: '4px',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1
        }}>
          {/* Update icon */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: '600',
              fontSize: '14px',
              color: '#172B4D',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              Update Available
              <span style={{
                background: '#2196F3',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '500'
              }}>
                v{status.latestVersion}
              </span>
              {status.isMandatoryUpdate && (
                <span style={{
                  background: '#FF5722',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  Required
                </span>
              )}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#6B778C'
            }}>
              {status.releaseNotes || 'A new version of the Desktop App is available.'}
              {status.appVersion && (
                <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                  Current: v{status.appVersion}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            onClick={handleDownloadClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: 'white',
              borderRadius: '4px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#1976D2'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#2196F3'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Update
          </button>

          {/* Only show dismiss if not mandatory */}
          {!status.isMandatoryUpdate && (
            <button
              onClick={dismissUpdate}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#6B778C',
                borderRadius: '4px'
              }}
              title="Remind me later"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  // Don't show if already shown today (for not-setup/inactive banners)
  if (alreadyShownToday) {
    return null;
  }

  // Don't show if desktop app is active and no update
  if (!status || !status.showDownload) {
    return null;
  }

  // PRIORITY 2: Show download/activate banner
  // Determine banner style based on status
  const getBannerStyle = () => {
    switch (status.status) {
      case 'not-setup':
        return {
          background: 'linear-gradient(135deg, #E3FCEF 0%, #ABF5D1 100%)',
          borderColor: '#36B37E',
          iconColor: '#006644'
        };
      case 'inactive':
      case 'logged-out':
        return {
          background: 'linear-gradient(135deg, #FFFAE6 0%, #FFE380 100%)',
          borderColor: '#FF8B00',
          iconColor: '#FF8B00'
        };
      default:
        return {
          background: '#F4F5F7',
          borderColor: '#DFE1E6',
          iconColor: '#6B778C'
        };
    }
  };

  const bannerStyle = getBannerStyle();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      background: bannerStyle.background,
      borderLeft: `4px solid ${bannerStyle.borderColor}`,
      borderRadius: '4px',
      marginBottom: '16px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: 1
      }}>
        {/* Icon */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
        }}>
          {status.status === 'not-setup' ? (
            // Download icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={bannerStyle.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          ) : (
            // Warning/inactive icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={bannerStyle.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: '600',
            fontSize: '14px',
            color: '#172B4D',
            marginBottom: '4px'
          }}>
            {status.status === 'not-setup'
              ? 'Desktop App Required'
              : 'Desktop App Not Active'}
          </div>
          <div style={{
            fontSize: '13px',
            color: '#6B778C'
          }}>
            {status.message}
            {status.lastHeartbeat && status.status !== 'not-setup' && (
              <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                Last seen: {new Date(status.lastHeartbeat).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {/* Show different button based on status */}
        {status.status === 'not-setup' ? (
          // User hasn't installed the app yet - show Download
          <button
            onClick={handleDownloadClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: '#0052CC',
              color: 'white',
              borderRadius: '4px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0065FF'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#0052CC'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download App
          </button>
        ) : (
          // User has the app but it's inactive/logged-out - show "Open App" hint
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: '#F4F5F7',
            color: '#172B4D',
            borderRadius: '4px',
            border: '1px solid #DFE1E6',
            fontSize: '13px',
            fontWeight: '500'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Open from System Tray
          </div>
        )}

        {/* Dismiss button (only for inactive/logged-out, not for not-setup) */}
        {status.status !== 'not-setup' && (
          <button
            onClick={() => {
              localStorage.setItem('desktopAppBannerLastShown', new Date().toDateString());
              setDismissed(true);
            }}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#6B778C',
              borderRadius: '4px'
            }}
            title="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default DesktopAppStatusBanner;
