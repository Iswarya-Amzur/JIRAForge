import React from 'react';
import { formatTime } from '../../utils';
import { parseUTC } from '../tabs/time-analytics/dateUtils';

/**
 * Screenshot Preview Modal Component
 * Modal for previewing session screenshots
 */
function ScreenshotPreviewModal({
  isOpen,
  previewSession,
  previewScreenshots,
  previewImageIndex,
  loadingScreenshots,
  onClose,
  onPrev,
  onNext,
  onExpand
}) {
  if (!isOpen || !previewSession) return null;

  const currentScreenshot = previewScreenshots[previewImageIndex];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content screenshot-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Session Screenshots - {previewSession.issueKey}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body screenshot-preview-body">
          {loadingScreenshots ? (
            <div className="loading-screenshots">
              <div className="spinner"></div>
              <p>Loading screenshots...</p>
            </div>
          ) : previewScreenshots.length === 0 ? (
            <div className="no-screenshots">
              <p>No screenshots available for this session.</p>
            </div>
          ) : (
            <>
              <div className="screenshot-viewer">
                <div
                  className="screenshot-image-container"
                  onClick={onExpand}
                  title="Click to expand"
                >
                  <img
                    src={currentScreenshot?.signed_url}
                    alt={`Screenshot ${previewImageIndex + 1}`}
                    className="screenshot-preview-image clickable"
                  />
                  <div className="expand-hint">
                    <span>🔍 Click to expand</span>
                  </div>
                </div>
                <div className="screenshot-info">
                  <p className="screenshot-app">
                    <strong>Application:</strong> {currentScreenshot?.application_name || 'Unknown'}
                  </p>
                  <p className="screenshot-window">
                    <strong>Window:</strong> {currentScreenshot?.window_title || 'Unknown'}
                  </p>
                  <p className="screenshot-time">
                    <strong>Time:</strong>{' '}
                    {currentScreenshot?.timestamp
                      ? (parseUTC(currentScreenshot.timestamp) || new Date(currentScreenshot.timestamp)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                      : 'Unknown'}
                  </p>
                </div>
              </div>
              {previewScreenshots.length > 1 && (
                <div className="screenshot-navigation">
                  <button className="nav-button prev" onClick={onPrev}>
                    ◀ Previous
                  </button>
                  <span className="screenshot-counter">
                    {previewImageIndex + 1} of {previewScreenshots.length}
                  </span>
                  <button className="nav-button next" onClick={onNext}>
                    Next ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer screenshot-footer">
          <p className="session-summary">
            Session: {(parseUTC(previewSession.session.startTime) || new Date(previewSession.session.startTime)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} -{' '}
            {(parseUTC(previewSession.session.endTime) || new Date(previewSession.session.endTime)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            {' | '}Duration: {formatTime(previewSession.session.duration)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ScreenshotPreviewModal;
