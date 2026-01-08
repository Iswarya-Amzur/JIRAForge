import React from 'react';

/**
 * Project Portfolio Table Component
 * Displays detailed project breakdown
 */
function ProjectPortfolioTable({ projects = [] }) {
  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Active';
      case 'moderate': return 'Moderate';
      case 'inactive': return 'Inactive';
      default: return status;
    }
  };

  return (
    <div className="org-portfolio-section">
      <div className="portfolio-header">
        <h3>Project Portfolio Details</h3>
        <span className="portfolio-subtitle">Complete breakdown of all project activity</span>
      </div>
      <div className="portfolio-table-container">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Total Hours</th>
              <th>Contributors</th>
              <th>Issues Worked</th>
              <th>Last Active</th>
              <th>Activity Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">No project data available</td>
              </tr>
            ) : (
              projects.map((project, idx) => (
                <tr key={idx}>
                  <td className="project-name-cell">
                    <span className="project-badge">{project.projectKey}</span>
                  </td>
                  <td className="hours-cell">
                    <strong>{project.totalHours}h</strong>
                  </td>
                  <td className="contributors-cell">
                    <span className="contributor-badge">{project.contributorCount}</span>
                  </td>
                  <td className="issues-cell">
                    {project.issueCount}
                  </td>
                  <td className="last-active-cell">
                    {project.lastActiveDate || 'Unknown'}
                  </td>
                  <td className="status-cell">
                    <span className={`status-indicator status-${project.activityStatus}`}>
                      {getStatusLabel(project.activityStatus)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectPortfolioTable;
