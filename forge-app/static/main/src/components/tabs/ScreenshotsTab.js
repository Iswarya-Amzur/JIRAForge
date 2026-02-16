import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { formatTime } from '../../utils';
import { parseUTC } from '../tabs/time-analytics/dateUtils';
import './ScreenshotsTab.css';

function ScreenshotsTab() {
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScreenshots, setSelectedScreenshots] = useState(new Set());
  const [galleryFullscreen, setGalleryFullscreen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    loadScreenshots();
  }, []);

  const loadScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getScreenshots');
      if (result.success) {
        setScreenshots(result.data.screenshots);
        setSelectedScreenshots(new Set());
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load screenshots: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScreenshot = async (screenshotId) => {
    try {
      const result = await invoke('deleteScreenshot', { screenshotId });
      if (result.success) {
        loadScreenshots();
        setSelectedScreenshots(prev => {
          const newSet = new Set(prev);
          newSet.delete(screenshotId);
          return newSet;
        });
      } else {
        alert('Failed to delete screenshot: ' + result.error);
      }
    } catch (err) {
      alert('Error deleting screenshot: ' + err.message);
    }
  };

  const handleBulkDeleteScreenshots = async () => {
    if (selectedScreenshots.size === 0) return;

    const count = selectedScreenshots.size;
    if (!window.confirm(`Are you sure you want to delete ${count} screenshot${count > 1 ? 's' : ''}?`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedScreenshots).map(screenshotId =>
        invoke('deleteScreenshot', { screenshotId })
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter(r => !r.success);

      if (failed.length > 0) {
        alert(`Failed to delete ${failed.length} screenshot(s). Please try again.`);
      } else {
        setSelectedScreenshots(new Set());
        loadScreenshots();
      }
    } catch (err) {
      alert('Error deleting screenshots: ' + err.message);
    }
  };

  const handleToggleSelect = (screenshotId) => {
    setSelectedScreenshots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(screenshotId)) {
        newSet.delete(screenshotId);
      } else {
        newSet.add(screenshotId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedScreenshots.size === screenshots.length) {
      setSelectedScreenshots(new Set());
    } else {
      setSelectedScreenshots(new Set(screenshots.map(s => s.id)));
    }
  };

  const openGalleryFullscreen = (index) => {
    setGalleryIndex(index);
    setGalleryFullscreen(true);
  };

  const closeGalleryFullscreen = () => {
    setGalleryFullscreen(false);
  };

  const nextGalleryImage = () => {
    if (screenshots.length > 0) {
      setGalleryIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : 0));
    }
  };

  const prevGalleryImage = () => {
    if (screenshots.length > 0) {
      setGalleryIndex((prev) => (prev > 0 ? prev - 1 : screenshots.length - 1));
    }
  };

  return (
    <>
      <div className="screenshot-gallery">
        <h2>Screenshot Gallery</h2>
        {loading ? (
          <p>Loading screenshots...</p>
        ) : error ? (
          <p className="error">Error: {error}</p>
        ) : screenshots.length === 0 ? (
          <p>No screenshots captured yet. Install the desktop app to start tracking.</p>
        ) : (
          <div className="screenshot-gallery-content">
            <div className="screenshot-toolbar">
              <p className="screenshot-count">Total: {screenshots.length} screenshots</p>
              {selectedScreenshots.size > 0 && (
                <div className="screenshot-bulk-actions">
                  <span className="selected-count">
                    {selectedScreenshots.size} selected
                  </span>
                  <button
                    className="select-all-btn"
                    onClick={handleSelectAll}
                  >
                    {selectedScreenshots.size === screenshots.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    className="bulk-delete-btn"
                    onClick={handleBulkDeleteScreenshots}
                  >
                    Delete Selected ({selectedScreenshots.size})
                  </button>
                </div>
              )}
              {selectedScreenshots.size === 0 && (
                <button
                  className="select-all-btn"
                  onClick={handleSelectAll}
                >
                  Select All
                </button>
              )}
            </div>
            <div className="screenshot-grid">
              {screenshots.map((screenshot, index) => (
                <div
                  key={screenshot.id}
                  className={`screenshot-item ${selectedScreenshots.has(screenshot.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="screenshot-checkbox"
                    checked={selectedScreenshots.has(screenshot.id)}
                    onChange={() => handleToggleSelect(screenshot.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select screenshot ${screenshot.id}`}
                  />
                  <button
                    className="screenshot-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to delete this screenshot?')) {
                        handleDeleteScreenshot(screenshot.id);
                      }
                    }}
                    title="Delete screenshot"
                    aria-label="Delete screenshot"
                  />
                  <div
                    className="screenshot-image-wrapper"
                    onClick={() => openGalleryFullscreen(index)}
                    title="Click to expand"
                  >
                    {(screenshot.signed_thumbnail_url || screenshot.thumbnail_url) ? (
                      <img
                        src={screenshot.signed_thumbnail_url || screenshot.thumbnail_url}
                        alt={screenshot.window_title || 'Screenshot'}
                        className="gallery-thumbnail"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <div className="screenshot-placeholder" style={{ display: (screenshot.signed_thumbnail_url || screenshot.thumbnail_url) ? 'none' : 'block' }}>
                      No Preview
                    </div>
                    <div className="gallery-expand-hint">🔍</div>
                  </div>
                  <div className="screenshot-info">
                    <p className="window-title" title={screenshot.window_title}>
                      {screenshot.window_title || 'Unknown Window'}
                    </p>
                    {screenshot.analysis_results && screenshot.analysis_results.length > 0 && screenshot.analysis_results[0].active_task_key && (
                      <p className="issue-key">
                        <strong>Issue:</strong> {screenshot.analysis_results[0].active_task_key}
                        {screenshot.duration_seconds &&
                          ` (${formatTime(screenshot.duration_seconds)})`
                        }
                      </p>
                    )}
                    {(!screenshot.analysis_results || screenshot.analysis_results.length === 0 || !screenshot.analysis_results[0].active_task_key) && (
                      <p className="issue-key unassigned">
                        <strong>Issue:</strong> Unassigned
                      </p>
                    )}
                    <p className="timestamp">
                      <strong>Time:</strong> {(parseUTC(screenshot.timestamp) || new Date(screenshot.timestamp)).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gallery Fullscreen View */}
      {galleryFullscreen && screenshots.length > 0 && (
        <div className="fullscreen-overlay" onClick={closeGalleryFullscreen}>
          <div className="fullscreen-content">
            <button className="fullscreen-close" onClick={closeGalleryFullscreen}>
              ✕ Close
            </button>
            <img
              src={screenshots[galleryIndex]?.signed_full_url || screenshots[galleryIndex]?.signed_thumbnail_url || screenshots[galleryIndex]?.thumbnail_url}
              alt={`Screenshot ${galleryIndex + 1}`}
              className="fullscreen-image"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="fullscreen-info">
              <span>{screenshots[galleryIndex]?.application_name || 'Unknown App'}</span>
              <span> | </span>
              <span>{screenshots[galleryIndex]?.window_title || 'Unknown Window'}</span>
              <span> | </span>
              <span>{screenshots[galleryIndex]?.timestamp
                ? (parseUTC(screenshots[galleryIndex].timestamp) || new Date(screenshots[galleryIndex].timestamp)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                : 'Unknown'}</span>
              <span> | </span>
              <span>{galleryIndex + 1} of {screenshots.length}</span>
            </div>
            {screenshots.length > 1 && (
              <>
                <button
                  className="fullscreen-nav fullscreen-prev"
                  onClick={(e) => { e.stopPropagation(); prevGalleryImage(); }}
                >
                  ◀
                </button>
                <button
                  className="fullscreen-nav fullscreen-next"
                  onClick={(e) => { e.stopPropagation(); nextGalleryImage(); }}
                >
                  ▶
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ScreenshotsTab;
