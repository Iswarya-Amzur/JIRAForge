import React, { useState, useRef } from 'react';
import { invoke } from '@forge/bridge';

const CATEGORIES = [
  { value: '', label: 'Select a category...' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' }
];

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TITLE_LENGTH = 200;

function FeedbackModal({ isOpen, onClose }) {
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]); // { name, type, base64, preview }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setCategory('');
    setTitle('');
    setDescription('');
    setImages([]);
    setError('');
    setSuccess(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setError('');

    const remaining = MAX_IMAGES - images.length;
    if (files.length > remaining) {
      setError(`You can add ${remaining} more screenshot${remaining !== 1 ? 's' : ''} (max ${MAX_IMAGES})`);
      return;
    }

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setError(`${file.name} exceeds 5MB limit`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target.result.split(',')[1];
        setImages((prev) => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, { name: file.name, type: file.type, base64, preview: evt.target.result }];
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError('');

    if (!category) {
      setError('Please select a category');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    setSubmitting(true);
    try {
      const result = await invoke('submitFeedback', {
        category,
        title: title.trim(),
        description: description.trim(),
        images: images.map((img) => ({ data: img.base64, name: img.name, type: img.type }))
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setError(result.error || 'Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <div className="feedback-success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <h3>Thank you!</h3>
              <p>Your feedback has been submitted successfully.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Send Feedback</h3>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="feedback-error">{error}</div>}

          <div className="feedback-field">
            <label className="feedback-label">
              Category <span className="feedback-required">*</span>
            </label>
            <select
              className="feedback-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value} disabled={cat.value === ''}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="feedback-field">
            <label className="feedback-label">Title</label>
            <input
              type="text"
              className="feedback-input"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
              placeholder="Brief summary (optional)"
              disabled={submitting}
              maxLength={MAX_TITLE_LENGTH}
            />
          </div>

          <div className="feedback-field">
            <label className="feedback-label">
              Description <span className="feedback-required">*</span>
            </label>
            <textarea
              className="feedback-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your feedback in detail..."
              rows={5}
              disabled={submitting}
            />
          </div>

          <div className="feedback-field">
            <label className="feedback-label">
              Screenshots {images.length > 0 && `(${images.length}/${MAX_IMAGES})`}
            </label>
            {images.length > 0 && (
              <div className="feedback-screenshots">
                {images.map((img, i) => (
                  <div key={i} className="feedback-screenshot-thumb">
                    <img src={img.preview} alt={img.name} />
                    <button
                      className="feedback-screenshot-remove"
                      onClick={() => removeImage(i)}
                      disabled={submitting}
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length < MAX_IMAGES && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageAdd}
                  style={{ display: 'none' }}
                  id="feedback-file-input"
                />
                <button
                  className="feedback-add-image-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  Add Screenshot
                </button>
              </>
            )}
            <span className="feedback-hint">Max {MAX_IMAGES} images, 5MB each</span>
          </div>
        </div>
        <div className="modal-footer">
          <button
            className="feedback-btn feedback-btn-cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="feedback-btn feedback-btn-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackModal;
