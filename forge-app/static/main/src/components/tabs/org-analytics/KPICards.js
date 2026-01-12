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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 8V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M23 11H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="kpi-content">
          <div className="kpi-value-row">
            <div className="kpi-value">{orgSummary?.activeUsers || 0}</div>
            <div className="kpi-info-wrapper">
              <span className="kpi-info-icon">i</span>
              <span className="kpi-info-tooltip">
                Number of team members who have tracked time this month using the desktop app.
              </span>
            </div>
          </div>
          <div className="kpi-label">Active Users</div>
          <div className={`kpi-change ${activeUsersChange >= 0 ? 'positive' : 'negative'}`}>
            {activeUsersChange >= 0 ? '+' : ''}{activeUsersChange} vs last month
          </div>
        </div>
      </div>

      <div className="org-kpi-card">
        <div className="kpi-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 20V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="kpi-content">
          <div className="kpi-value-row">
            <div className="kpi-value">{orgSummary?.totalHours || 0}h</div>
            <div className="kpi-info-wrapper">
              <span className="kpi-info-icon">i</span>
              <span className="kpi-info-tooltip">
                Sum of all tracked hours across the entire organization for the current month.
              </span>
            </div>
          </div>
          <div className="kpi-label">Total Hours This Month</div>
          <div className={`kpi-change ${totalHoursChange >= 0 ? 'positive' : 'negative'}`}>
            {totalHoursChange >= 0 ? '↑' : '↓'} {Math.abs(totalHoursChange)}% vs last month
          </div>
        </div>
      </div>

      <div className="org-kpi-card">
        <div className="kpi-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="kpi-content">
          <div className="kpi-value-row">
            <div className="kpi-value">{orgSummary?.activeProjects || 0}</div>
            <div className="kpi-info-wrapper">
              <span className="kpi-info-icon">i</span>
              <span className="kpi-info-tooltip">
                Number of projects with at least one tracked time entry this month.
              </span>
            </div>
          </div>
          <div className="kpi-label">Active Projects</div>
          <div className={`kpi-change ${projectsChange >= 0 ? 'positive' : 'negative'}`}>
            {projectsChange >= 0 ? '+' : ''}{projectsChange} vs last month
          </div>
        </div>
      </div>
    </div>
  );
}

export default KPICards;
