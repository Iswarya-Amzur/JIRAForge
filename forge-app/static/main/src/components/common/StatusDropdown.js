import React, { useState, useEffect } from 'react';

/**
 * Status Dropdown Component - allows changing issue status via transitions
 * @param {Object} props
 * @param {Object} props.issue - The issue object with key, status, statusCategory
 * @param {Function} props.onStatusChange - Callback when status changes (issueKey, transitionId)
 * @param {boolean} props.isUpdating - Whether a status update is in progress
 * @param {Function} props.onLoadTransitions - Callback to load transitions for an issue
 */
function StatusDropdown({ issue, onStatusChange, isUpdating, onLoadTransitions }) {
  const [isOpen, setIsOpen] = useState(false);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (isUpdating) return;

    if (!isOpen && transitions.length === 0) {
      setLoading(true);
      const trans = await onLoadTransitions(issue.key);
      setTransitions(trans);
      setLoading(false);
    }
    setIsOpen(!isOpen);
  };

  const handleTransitionSelect = (e, transitionId) => {
    e.stopPropagation();
    setIsOpen(false);
    onStatusChange(issue.key, transitionId);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="status-dropdown-container" onClick={(e) => e.stopPropagation()}>
      <button
        className={`status-dropdown-button status-badge status-${issue.statusCategory}`}
        onClick={handleClick}
        disabled={isUpdating}
      >
        {isUpdating ? '...' : issue.status}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="status-dropdown-menu">
          {loading ? (
            <div className="dropdown-loading">Loading...</div>
          ) : transitions.length === 0 ? (
            <div className="dropdown-empty">No transitions available</div>
          ) : (
            transitions.map((transition) => (
              <button
                key={transition.id}
                className={`dropdown-item status-${transition.to.statusCategory}`}
                onClick={(e) => handleTransitionSelect(e, transition.id)}
                disabled={isUpdating}
              >
                {transition.to.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default StatusDropdown;
