import React from 'react';
import { parseUTC } from '../tabs/time-analytics/dateUtils';
import './FullscreenViewer.css';

function FullscreenViewer({
  isOpen,
  screenshots,
  currentIndex,
  onClose,
  onNext,
  onPrev
}) {
  if (!isOpen || !screenshots || screenshots.length === 0) return null;

  const currentScreenshot = screenshots[currentIndex];

  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <div className="fullscreen-content">
        <button className="fullscreen-close" onClick={onClose}>
          ✕ Close
        </button>
        <img
          src={currentScreenshot?.signed_url}
          alt={`Screenshot ${currentIndex + 1}`}
          className="fullscreen-image"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="fullscreen-info">
          <span>{currentScreenshot?.application_name || 'Unknown App'}</span>
          <span> | </span>
          <span>{currentScreenshot?.window_title || 'Unknown Window'}</span>
          <span> | </span>
          <span>{currentScreenshot?.timestamp
            ? (parseUTC(currentScreenshot.timestamp) || new Date(currentScreenshot.timestamp)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
            : 'Unknown'}</span>
          <span> | </span>
          <span>{currentIndex + 1} of {screenshots.length}</span>
        </div>
        {screenshots.length > 1 && (
          <>
            <button
              className="fullscreen-nav fullscreen-prev"
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
            >
              ◀
            </button>
            <button
              className="fullscreen-nav fullscreen-next"
              onClick={(e) => { e.stopPropagation(); onNext(); }}
            >
              ▶
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FullscreenViewer;
