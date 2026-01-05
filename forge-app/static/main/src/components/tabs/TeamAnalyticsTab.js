import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { useApp } from '../../context';
import { navigateToIssue, formatTime } from '../../utils';
import './TeamAnalyticsTab.css';

function TeamAnalyticsTab() {
  const { userPermissions, selectedProjectKey, setSelectedProjectKey } = useApp();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamAnalytics, setTeamAnalytics] = useState(null);

  useEffect(() => {
    if (selectedProjectKey) {
      loadTeamAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectKey]);

  const loadTeamAnalytics = async () => {
    if (!selectedProjectKey) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getProjectTeamAnalytics', { projectKey: selectedProjectKey });
      if (result.success) {
        setTeamAnalytics(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load team analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="team-analytics">
      <div className="team-analytics-header">
        <h2>Team Analytics Dashboard</h2>
        <div className="project-selector">
          <label htmlFor="team-project-select">Project: </label>
          <select
            id="team-project-select"
            value={selectedProjectKey}
            onChange={(e) => setSelectedProjectKey(e.target.value)}
          >
            {(userPermissions.isJiraAdmin
              ? userPermissions.allProjectKeys
              : userPermissions.projectAdminProjects
            )?.map(pk => (
              <option key={pk} value={pk}>{pk}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading team analytics...</p>
        </div>
      ) : error ? (
        <p className="error">Error: {error}</p>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="team-kpi-cards">
            <div className="team-kpi-card">
              <div className="kpi-icon">📊</div>
              <div className="kpi-content">
                <div className="kpi-value-row">
                  <div className="kpi-value">{teamAnalytics?.teamSummary?.totalHoursThisMonth || 0}h</div>
                  <div className="kpi-info-wrapper">
                    <span className="kpi-info-icon">i</span>
                    <span className="kpi-info-tooltip">
                      Total hours tracked by all team members on this project during the current month.
                    </span>
                  </div>
                </div>
                <div className="kpi-label">Total Hours This Month</div>
              </div>
            </div>
            <div className="team-kpi-card">
              <div className="kpi-icon">👥</div>
              <div className="kpi-content">
                <div className="kpi-value-row">
                  <div className="kpi-value">{teamAnalytics?.teamSummary?.activeMembers || 0}</div>
                  <div className="kpi-info-wrapper">
                    <span className="kpi-info-icon">i</span>
                    <span className="kpi-info-tooltip">
                      Number of team members who have tracked at least some time on this project this month.
                    </span>
                  </div>
                </div>
                <div className="kpi-label">Active Members</div>
              </div>
            </div>
            <div className="team-kpi-card">
              <div className="kpi-icon">📋</div>
              <div className="kpi-content">
                <div className="kpi-value-row">
                  <div className="kpi-value">{teamAnalytics?.teamSummary?.issuesWorked || 0}</div>
                  <div className="kpi-info-wrapper">
                    <span className="kpi-info-icon">i</span>
                    <span className="kpi-info-tooltip">
                      Number of unique Jira issues with tracked time entries this month.
                    </span>
                  </div>
                </div>
                <div className="kpi-label">Issues Worked</div>
              </div>
            </div>
          </div>

          {/* Two Column Layout: Member Activity + Activity Trend */}
          <div className="team-analytics-grid">
            {/* Team Member Activity Table */}
            <div className="team-section team-member-activity">
              <div className="section-header">
                <div className="section-title-row">
                  <h3>Team Member Activity</h3>
                  <div className="section-info-wrapper">
                    <span className="section-info-icon">i</span>
                    <span className="section-info-tooltip">
                      Breakdown of hours tracked by each team member for today, this week (Mon-Sun), and this month.
                    </span>
                  </div>
                </div>
                <span className="section-subtitle">Hours tracked by each team member</span>
              </div>
              <div className="team-member-table-container">
                <table className="team-member-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>
                        Today
                        <span className="info-icon-wrapper">
                          <span className="info-icon">ℹ</span>
                          <span className="info-tooltip">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                          </span>
                        </span>
                      </th>
                      <th>
                        This Week
                        <span className="info-icon-wrapper">
                          <span className="info-icon">ℹ</span>
                          <span className="info-tooltip">
                            {(() => {
                              const now = new Date();
                              const dayOfWeek = now.getDay();
                              const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                              const monday = new Date(now);
                              monday.setDate(now.getDate() - daysToMonday);
                              const sunday = new Date(monday);
                              sunday.setDate(monday.getDate() + 6);
                              const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              return `${formatDate(monday)} - ${formatDate(sunday)}`;
                            })()}
                          </span>
                        </span>
                      </th>
                      <th>
                        This Month
                        <span className="info-icon-wrapper">
                          <span className="info-icon">ℹ</span>
                          <span className="info-tooltip">
                            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </span>
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamAnalytics?.teamMemberActivity?.length > 0 ? (
                      teamAnalytics.teamMemberActivity.map((member, idx) => (
                        <tr key={idx}>
                          <td className="member-name-cell">
                            <span className="member-avatar">👤</span>
                            <span className="member-name">{member.displayName}</span>
                          </td>
                          <td className="hours-cell"><strong>{member.todayHours}h</strong></td>
                          <td className="hours-cell"><strong>{member.weekHours}h</strong></td>
                          <td className="hours-cell"><strong>{member.monthHours}h</strong></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="empty-state">No team member activity yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Activity Trend Chart */}
            <div className="team-section team-activity-trend">
              <div className="section-header">
                <div className="section-title-row">
                  <h3>Activity Trend</h3>
                  <div className="section-info-wrapper">
                    <span className="section-info-icon">i</span>
                    <span className="section-info-tooltip">
                      Visual representation of daily team work hours over the last 14 days. Taller bars indicate more hours tracked.
                    </span>
                  </div>
                </div>
                <span className="section-subtitle">Daily team hours - Last 14 days</span>
              </div>
              <div className="trend-chart-container">
                {teamAnalytics?.activityTrend?.length > 0 ? (
                  <div className="trend-chart">
                    {(() => {
                      const maxHours = Math.max(...teamAnalytics.activityTrend.map(d => d.totalHours), 0.1);
                      const maxBarHeight = 140; // Fixed pixel height for the tallest bar
                      return teamAnalytics.activityTrend.map((day, idx) => {
                        // Calculate bar height in pixels (minimum 4px if there's any value)
                        const barHeight = day.totalHours > 0
                          ? Math.max(4, Math.round((day.totalHours / maxHours) * maxBarHeight))
                          : 0;
                        return (
                          <div key={idx} className="trend-bar-wrapper">
                            <div
                              className={`trend-bar ${day.totalHours === 0 ? 'empty-bar' : ''}`}
                              style={{ height: `${barHeight}px` }}
                              title={`${day.date}: ${day.totalHours}h`}
                            >
                              {day.totalHours > 0 && (
                                <span className="trend-bar-value">{day.totalHours}h</span>
                              )}
                            </div>
                            <span className="trend-bar-label">{day.dayOfMonth}</span>
                            <span className="trend-bar-day">{day.dayOfWeek}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p className="empty-state">No activity trend data available</p>
                )}
              </div>
            </div>
          </div>

          {/* Time by Issue Section */}
          <div className="team-section team-time-by-issue">
            <div className="section-header">
              <div className="section-title-row">
                <h3>Time by Issue</h3>
                <div className="section-info-wrapper">
                  <span className="section-info-icon">i</span>
                  <span className="section-info-tooltip">
                    Top issues by time tracked. Shows total hours and number of team members who contributed to each issue.
                  </span>
                </div>
              </div>
              <span className="section-subtitle">Team effort distribution across issues</span>
            </div>
            <div className="issue-bars-container">
              {teamAnalytics?.teamTimeByIssue?.length > 0 ? (
                (() => {
                  const maxSeconds = Math.max(...teamAnalytics.teamTimeByIssue.map(i => i.totalSeconds), 1);
                  return teamAnalytics.teamTimeByIssue.slice(0, 10).map((issue, idx) => (
                    <div key={idx} className="issue-bar-item">
                      <div className="issue-bar-header">
                        <a
                          href={`/browse/${issue.issueKey}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigateToIssue(issue.issueKey);
                          }}
                          className="issue-key-link"
                        >
                          {issue.issueKey}
                        </a>
                        <span className="issue-stats">
                          <span className="issue-hours">{formatTime(issue.totalSeconds)}</span>
                          <span className="issue-contributors">👥 {issue.contributors}</span>
                        </span>
                      </div>
                      <div className="issue-bar-track">
                        <div
                          className="issue-bar-fill"
                          style={{ width: `${(issue.totalSeconds / maxSeconds) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ));
                })()
              ) : (
                <p className="empty-state">No issue data available yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TeamAnalyticsTab;
