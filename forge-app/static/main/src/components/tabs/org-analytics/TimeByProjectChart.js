import React from 'react';

/**
 * Time By Project Chart Component
 * Displays horizontal bar chart for project hours
 */
function TimeByProjectChart({ projects = [] }) {
  const maxHours = Math.max(...projects.map(p => p.totalHours || 0), 1);

  if (projects.length === 0) {
    return (
      <div className="org-chart-card">
        <div className="chart-header">
          <div className="chart-title-row">
            <h3>Time By Project</h3>
            <div className="chart-info-wrapper">
              <span className="chart-info-icon">i</span>
              <span className="chart-info-tooltip">
                Hours tracked per project this month. Bar length shows relative time spent. Includes contributor count and month-over-month trend.
              </span>
            </div>
          </div>
          <span className="chart-subtitle">Hours tracked this month</span>
        </div>
        <div className="project-bars">
          <p className="empty-state">No project data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="org-chart-card">
      <div className="chart-header">
        <div className="chart-title-row">
          <h3>Time By Project</h3>
          <div className="chart-info-wrapper">
            <span className="chart-info-icon">i</span>
            <span className="chart-info-tooltip">
              Hours tracked per project this month. Bar length shows relative time spent. Includes contributor count and month-over-month trend.
            </span>
          </div>
        </div>
        <span className="chart-subtitle">Hours tracked this month</span>
      </div>
      <div className="project-bars">
        {projects.slice(0, 8).map((project, idx) => (
          <div key={idx} className="project-bar-item">
            <div className="project-bar-label">
              <span className="project-key">{project.projectKey}</span>
              <span className="project-hours">{project.totalHours}h</span>
            </div>
            <div className="project-bar-container">
              <div
                className={`project-bar-fill status-${project.status}`}
                style={{ width: `${(project.totalHours / maxHours) * 100}%` }}
              ></div>
            </div>
            <div className="project-bar-meta">
              <span className="contributor-count">{project.contributorCount} contributors</span>
              <span className={`trend-indicator ${project.trendPercent >= 0 ? 'up' : 'down'}`}>
                {project.trendPercent >= 0 ? '↑' : '↓'} {Math.abs(project.trendPercent)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TimeByProjectChart;
