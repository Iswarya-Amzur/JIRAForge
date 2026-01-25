import React, { useState, useEffect } from 'react';
import { invoke, router } from '@forge/bridge';

/**
 * Desktop App Status Banner Component
 * Shows a banner when the Desktop App is not running or not installed
 */
function DesktopAppStatusBanner({ downloadUrl = 'https://your-download-url.com' }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [alreadyShownToday, setAlreadyShownToday] = useState(false);

  // Check if banner was already shown today
  useEffect(() => {
    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('desktopAppBannerLastShown');
    if (lastShown === today) {
      setAlreadyShownToday(true);
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
      }
    } catch (error) {
      console.error('Error checking desktop app status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show anything while loading
  if (loading) {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  // Don't show if already shown today
  if (alreadyShownToday) {
    return null;
  }

  // Don't show on weekends (Saturday = 6, Sunday = 0)
  const today = new Date().getDay();
  if (today === 0 || today === 6) {
    return null;
  }

  // Don't show if desktop app is active
  if (!status || !status.showDownload) {
    return null;
  }

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
        <button
          onClick={() => {
            localStorage.setItem('desktopAppBannerLastShown', new Date().toDateString());
            router.open(downloadUrl);
          }}
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
