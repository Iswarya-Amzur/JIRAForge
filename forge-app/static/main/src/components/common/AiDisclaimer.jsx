import React from 'react';

export const AiDisclaimer = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    background: '#F4F5F7',
    borderRadius: '3px',
    marginTop: '8px',
    marginBottom: '8px'
  }}>
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
);
