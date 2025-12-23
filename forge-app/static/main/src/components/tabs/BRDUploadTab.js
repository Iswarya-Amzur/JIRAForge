import React, { useState } from 'react';
import { invoke } from '@forge/bridge';
import { navigateToIssue } from '../../utils';
import './BRDUploadTab.css';

function BRDUploadTab() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [currentDocument, setCurrentDocument] = useState(null);
  const [projectKey, setProjectKey] = useState('');

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
    const maxAttempts = 60;
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
            setTimeout(poll, 5000);
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

    setTimeout(poll, 2000);
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

  const handleBRDUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setUploadProgress(10);
    setProcessingStatus('Uploading document...');

    try {
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
                        <a
                          href={`/browse/${issue.key}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateToIssue(issue.key);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
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
  );
}

export default BRDUploadTab;
