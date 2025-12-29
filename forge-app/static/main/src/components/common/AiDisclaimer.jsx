import React from 'react';
import { Lozenge } from '@forge/react';

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
    <Lozenge appearance="new" isBold>AI Generated</Lozenge>
    <span style={{ fontSize: '12px', color: '#6B778C' }}>
      These items were grouped by AI. Please review for accuracy.
    </span>
  </div>
);
