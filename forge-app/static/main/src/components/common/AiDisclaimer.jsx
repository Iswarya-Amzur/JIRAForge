import React from 'react';

export const AiDisclaimer = ({ 
  notificationsEnabled, 
  onToggleNotifications, 
  savingNotificationSettings 
}) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '12px 16px',
    background: '#F4F5F7',
    borderRadius: '3px',
    marginTop: '8px',
    marginBottom: '8px'
  }}>
    {/* Left side - AI Generated label */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{
        display: 'inline-block',
        padding: '2px 6px',
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        backgroundColor: '#6554C0',
        color: '#FFFFFF',
        borderRadius: '3px',
        lineHeight: '1.2'
      }}>AI Generated</span>
      <span style={{ fontSize: '12px', color: '#6B778C' }}>
        These items were grouped by AI. Please review for accuracy.
      </span>
    </div>

    {/* Right side - Desktop Notification toggle */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '13px', color: '#42526E', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
        Desktop Notification
        <span 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '14px', 
            height: '14px', 
            borderRadius: '50%', 
            backgroundColor: '#DFE1E6', 
            color: '#5E6C84', 
            fontSize: '10px', 
            fontWeight: '600',
            cursor: 'help'
          }}
          title="Enable to receive desktop reminders about unassigned work"
        >
          i
        </span>
      </span>
      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
        <input
          type="checkbox"
          checked={notificationsEnabled}
          onChange={onToggleNotifications}
          disabled={savingNotificationSettings}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
          position: 'absolute',
          cursor: savingNotificationSettings ? 'not-allowed' : 'pointer',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: notificationsEnabled ? '#6554C0' : '#c1c7d0',
          transition: '0.3s',
          borderRadius: '22px',
          opacity: savingNotificationSettings ? 0.6 : 1
        }}>
          <span style={{
            position: 'absolute',
            content: '',
            height: '16px',
            width: '16px',
            left: notificationsEnabled ? '25px' : '3px',
            bottom: '3px',
            backgroundColor: 'white',
            transition: '0.3s',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}></span>
        </span>
      </label>
    </div>
  </div>
);
