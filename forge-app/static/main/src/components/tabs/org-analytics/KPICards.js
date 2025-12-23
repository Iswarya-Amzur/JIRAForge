import React from 'react';

/**
 * KPI Cards Component
 * Displays executive summary metrics
 */
function KPICards({ orgSummary }) {
  const totalHoursChange = orgSummary?.totalHoursChange || 0;
  const projectsChange = orgSummary?.projectsChange || 0;
  const activeUsersChange = orgSummary?.activeUsersChange || 0;

  return (
    <div className="org-kpi-cards">
      <div className="org-kpi-card">
        <div className="kpi-icon">
          <span>&#128200;</span>
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{orgSummary?.totalHours || 0}h</div>
          <div className="kpi-label">Total Hours This Month</div>
          <div className={`kpi-change ${totalHoursChange >= 0 ? 'positive' : 'negative'}`}>
            {totalHoursChange >= 0 ? '↑' : '↓'} {Math.abs(totalHoursChange)}% vs last month
          </div>
        </div>
      </div>

      <div className="org-kpi-card">
        <div className="kpi-icon">
          <span>&#128193;</span>
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{orgSummary?.activeProjects || 0}</div>
          <div className="kpi-label">Active Projects</div>
          <div className={`kpi-change ${projectsChange >= 0 ? 'positive' : 'negative'}`}>
            {projectsChange >= 0 ? '+' : ''}{projectsChange} vs last month
          </div>
        </div>
      </div>

      <div className="org-kpi-card">
        <div className="kpi-icon">
          <span>&#128101;</span>
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{orgSummary?.activeUsers || 0}</div>
          <div className="kpi-label">Active Users</div>
          <div className={`kpi-change ${activeUsersChange >= 0 ? 'positive' : 'negative'}`}>
            {activeUsersChange >= 0 ? '+' : ''}{activeUsersChange} vs last month
          </div>
        </div>
      </div>

      <div className="org-kpi-card">
        <div className="kpi-icon">
          <span>&#128200;</span>
        </div>
        <div className="kpi-content">
          <div className="kpi-value">{orgSummary?.adoptionRate || 0}%</div>
          <div className="kpi-label">Adoption Rate</div>
          <div className="kpi-subtext">
            {orgSummary?.activeUsers || 0} of {orgSummary?.totalUsers || 0} users
          </div>
        </div>
      </div>
    </div>
  );
}

export default KPICards;
