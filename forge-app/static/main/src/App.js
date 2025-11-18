import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('time-analytics');
  const [timeData, setTimeData] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // BRD Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [currentDocument, setCurrentDocument] = useState(null);
  const [projectKey, setProjectKey] = useState('');

  useEffect(() => {
    if (activeTab === 'time-analytics') {
      loadTimeAnalytics();
    } else if (activeTab === 'screenshots') {
      loadScreenshots();
    }
  }, [activeTab]);

  const loadTimeAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getTimeAnalytics');
      if (result.success) {
        setTimeData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load time analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getScreenshots');
      if (result.success) {
        setScreenshots(result.data.screenshots);
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
        loadScreenshots(); // Reload the list
      } else {
        alert('Failed to delete screenshot: ' + result.error);
      }
    } catch (err) {
      alert('Error deleting screenshot: ' + err.message);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'application/pdf' ||
                 file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      setSelectedFile(file);
    } else {
      alert('Please select a PDF or DOCX file');
    }
  };

  const pollBRDStatus = async (documentId) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (5 second intervals)
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setProcessingStatus('Processing is taking longer than expected. Please check back later.');
        return;
      }

      try {
        const result = await invoke('getBRDStatus', { documentId });
        if (result.success && result.document) {
          setCurrentDocument(result.document);
          const status = result.document.processing_status;
          
          if (status === 'completed') {
            setProcessingStatus('Document processed successfully! You can now create Jira issues.');
          } else if (status === 'failed') {
            setProcessingStatus(`Processing failed: ${result.document.error_message || 'Unknown error'}`);
          } else {
            setProcessingStatus(`Processing status: ${status}...`);
            attempts++;
            setTimeout(poll, 5000); // Poll every 5 seconds
          }
        }
      } catch (err) {
        console.error('Error polling BRD status:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        }
      }
    };

    setTimeout(poll, 2000); // Start polling after 2 seconds
  };

  const handleCreateIssues = async () => {
    if (!currentDocument || !projectKey) {
      alert('Please enter a project key');
      return;
    }

    setProcessingStatus('Creating Jira issues...');
    try {
      const result = await invoke('createIssuesFromBRD', {
        documentId: currentDocument.id,
        projectKey: projectKey.trim().toUpperCase()
      });

      if (result.success) {
        setProcessingStatus(result.message || 'Issues created successfully!');
        // Refresh document status to show created issues
        const statusResult = await invoke('getBRDStatus', { documentId: currentDocument.id });
        if (statusResult.success) {
          setCurrentDocument(statusResult.document);
        }
      } else {
        setProcessingStatus('Error creating issues: ' + result.error);
      }
    } catch (err) {
      setProcessingStatus('Error creating issues: ' + err.message);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleBRDUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setUploadProgress(10);
    setProcessingStatus('Uploading document...');

    try {
      // Convert file to base64 for transfer
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];

        setUploadProgress(50);
        setProcessingStatus('Processing document...');

        const result = await invoke('uploadBRD', {
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileData: base64Data,
          fileSize: selectedFile.size
        });

        if (result.success) {
          setUploadProgress(100);
          setProcessingStatus('Document uploaded successfully! Processing will begin shortly.');
          setCurrentDocument({ id: result.documentId, status: 'uploaded' });
          setSelectedFile(null);
          // Start polling for status updates
          pollBRDStatus(result.documentId);
        } else {
          setProcessingStatus('Error: ' + result.error);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setProcessingStatus('Error uploading document: ' + err.message);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>BRD Automate & Time Tracker</h1>
        <nav className="tabs">
          <button
            className={activeTab === 'time-analytics' ? 'active' : ''}
            onClick={() => setActiveTab('time-analytics')}
          >
            Time Analytics
          </button>
          <button
            className={activeTab === 'screenshots' ? 'active' : ''}
            onClick={() => setActiveTab('screenshots')}
          >
            Screenshot Gallery
          </button>
          <button
            className={activeTab === 'brd-upload' ? 'active' : ''}
            onClick={() => setActiveTab('brd-upload')}
          >
            BRD Upload
          </button>
        </nav>
      </header>

      <main className="App-content">
        {activeTab === 'time-analytics' && (
          <div className="time-analytics">
            <h2>Time Analytics Dashboard</h2>
            {loading ? (
              <p>Loading analytics...</p>
            ) : error ? (
              <p className="error">Error: {error}</p>
            ) : (
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>Daily Summary (Last 30 Days)</h3>
                  {timeData?.dailySummary && timeData.dailySummary.length > 0 ? (
                    <div className="data-list">
                      {timeData.dailySummary.slice(0, 10).map((day, idx) => (
                        <div key={idx} className="data-item">
                          <span className="label">{new Date(day.work_date).toLocaleDateString()}</span>
                          <span className="value">
                            {day.active_task_key || 'No task'} - {formatTime(day.total_seconds)}
                          </span>
                        </div>
                      ))}
                      {timeData.dailySummary.length > 10 && (
                        <p className="more-data">+ {timeData.dailySummary.length - 10} more days</p>
                      )}
                    </div>
                  ) : (
                    <p>No data available yet. Install the desktop app to start tracking.</p>
                  )}
                </div>
                <div className="analytics-card">
                  <h3>Weekly Summary (Last 12 Weeks)</h3>
                  {timeData?.weeklySummary && timeData.weeklySummary.length > 0 ? (
                    <div className="data-list">
                      {timeData.weeklySummary.map((week, idx) => (
                        <div key={idx} className="data-item">
                          <span className="label">Week of {new Date(week.week_start).toLocaleDateString()}</span>
                          <span className="value">{formatTime(week.total_seconds)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No data available yet.</p>
                  )}
                </div>
                <div className="analytics-card">
                  <h3>Time by Project</h3>
                  {timeData?.timeByProject && timeData.timeByProject.length > 0 ? (
                    <div className="data-list">
                      {timeData.timeByProject.map((project, idx) => (
                        <div key={idx} className="data-item">
                          <span className="label">{project.active_project_key || 'Unknown'}</span>
                          <span className="value">{formatTime(project.total_seconds)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No data available yet.</p>
                  )}
                </div>
                <div className="analytics-card">
                  <h3>Time by Issue (Top 20)</h3>
                  {timeData?.timeByIssue && timeData.timeByIssue.length > 0 ? (
                    <div className="data-list">
                      {timeData.timeByIssue.slice(0, 20).map((issue, idx) => (
                        <div key={idx} className="data-item">
                          <span className="label">
                            <a href={`/browse/${issue.issueKey}`} target="_blank" rel="noopener noreferrer">
                              {issue.issueKey}
                            </a>
                          </span>
                          <span className="value">{formatTime(issue.totalSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No data available yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'screenshots' && (
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
                <p className="screenshot-count">Total: {screenshots.length} screenshots</p>
                <div className="screenshot-grid">
                  {screenshots.map(screenshot => (
                    <div key={screenshot.id} className="screenshot-item">
                      {screenshot.thumbnail_url ? (
                        <img 
                          src={screenshot.thumbnail_url} 
                          alt={screenshot.window_title || 'Screenshot'} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <div className="screenshot-placeholder" style={{ display: screenshot.thumbnail_url ? 'none' : 'block' }}>
                        No Preview
                      </div>
                      <div className="screenshot-info">
                        <p className="window-title" title={screenshot.window_title}>
                          {screenshot.window_title || 'Unknown Window'}
                        </p>
                        <p className="app-name">{screenshot.application_name || 'Unknown App'}</p>
                        <p className="timestamp">{new Date(screenshot.timestamp).toLocaleString()}</p>
                        <p className="status">Status: {screenshot.status || 'pending'}</p>
                        <button 
                          className="delete-btn"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this screenshot?')) {
                              handleDeleteScreenshot(screenshot.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'brd-upload' && (
          <div className="brd-upload">
            <h2>Upload BRD Document</h2>
            <div className="upload-container">
              <p>Upload a PDF or DOCX document containing your Business Requirements Document.</p>
              <p>The AI will analyze it and automatically create Jira issues (Epics, Stories, and Tasks).</p>

              <div className="file-input-container">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileSelect}
                  id="file-input"
                />
                <label htmlFor="file-input" className="file-input-label">
                  {selectedFile ? selectedFile.name : 'Choose File (PDF or DOCX)'}
                </label>
              </div>

              {selectedFile && (
                <button className="upload-button" onClick={handleBRDUpload}>
                  Upload and Process
                </button>
              )}

              {processingStatus && (
                <div className="processing-status">
                  <p>{processingStatus}</p>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}

              {currentDocument && (
                <div className="document-status">
                  <h3>Document Status</h3>
                  <p><strong>Status:</strong> {currentDocument.processing_status || 'unknown'}</p>
                  <p><strong>File:</strong> {currentDocument.file_name}</p>
                  
                  {currentDocument.processing_status === 'completed' && (
                    <div className="create-issues-section">
                      <h4>Create Jira Issues</h4>
                      <div className="project-key-input">
                        <label htmlFor="project-key">Project Key:</label>
                        <input
                          type="text"
                          id="project-key"
                          value={projectKey}
                          onChange={(e) => setProjectKey(e.target.value)}
                          placeholder="e.g., PROJ"
                          style={{ marginLeft: '10px', padding: '5px' }}
                        />
                        <button 
                          className="create-issues-btn"
                          onClick={handleCreateIssues}
                          disabled={!projectKey.trim()}
                        >
                          Create Issues
                        </button>
                      </div>
                    </div>
                  )}

                  {currentDocument.created_issues && currentDocument.created_issues.length > 0 && (
                    <div className="created-issues">
                      <h4>Created Issues ({currentDocument.created_issues.filter(i => i.key).length})</h4>
                      <ul>
                        {currentDocument.created_issues.map((issue, idx) => (
                          <li key={idx}>
                            {issue.key ? (
                              <a href={`/browse/${issue.key}`} target="_blank" rel="noopener noreferrer">
                                {issue.key} - {issue.type}: {issue.summary}
                              </a>
                            ) : (
                              <span className="error-issue">
                                {issue.error}: {issue.details}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
