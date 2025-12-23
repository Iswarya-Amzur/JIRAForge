import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import {
  KPICards,
  TimeByProjectChart,
  ActivityTrendChart,
  ProjectPortfolioTable,
  UserActivityTable
} from './org-analytics';
import './OrgAnalyticsTab.css';

/**
 * Organization Analytics Tab Component
 * Orchestrates the organization analytics dashboard
 */
function OrgAnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orgAnalytics, setOrgAnalytics] = useState(null);

  useEffect(() => {
    loadOrgAnalytics();
  }, []);

  const loadOrgAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getAllAnalytics');
      if (result.success) {
        setOrgAnalytics(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load organization analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="org-analytics">
        <h2>Organization Analytics Dashboard</h2>
        <p className="admin-notice">Jira Administrator View - Enterprise Overview</p>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading organization analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="org-analytics">
        <h2>Organization Analytics Dashboard</h2>
        <p className="admin-notice">Jira Administrator View - Enterprise Overview</p>
        <p className="error">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="org-analytics">
      <h2>Organization Analytics Dashboard</h2>
      <p className="admin-notice">Jira Administrator View - Enterprise Overview</p>

      <KPICards orgSummary={orgAnalytics?.orgSummary} />

      <div className="org-charts-row">
        <TimeByProjectChart projects={orgAnalytics?.projectPortfolio} />
        <ActivityTrendChart dailySummary={orgAnalytics?.dailySummary} />
      </div>

      <ProjectPortfolioTable projects={orgAnalytics?.projectPortfolio} />
      <UserActivityTable users={orgAnalytics?.userActivity} />
    </div>
  );
}

export default OrgAnalyticsTab;
