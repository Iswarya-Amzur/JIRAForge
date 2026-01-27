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

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      '#0052CC', '#00875A', '#FF5630', '#6554C0',
      '#FF991F', '#00B8D9', '#36B37E', '#FFAB00',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

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
              <div className="kpi-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 20V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
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

          {/* Two Column Layout: Activity Trend + Member Activity */}
          <div className="team-analytics-grid">
            {/* Activity Trend Chart - First */}
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
                        // Calculate bar height in pixels (minimum 8px if there's any value for visibility)
                        const barHeight = day.totalHours > 0
                          ? Math.max(8, Math.round((day.totalHours / maxHours) * maxBarHeight))
                          : 0;
                        const isWeekend = day.dayOfWeek === 'Sat' || day.dayOfWeek === 'Sun';
                        return (
                          <div key={idx} className="trend-bar-wrapper">
                            <span className="trend-bar-value">{day.totalHours > 0 ? `${day.totalHours}h` : '\u00A0'}</span>
                            <div
                              className={`trend-bar ${day.totalHours === 0 ? 'empty-bar' : ''} ${isWeekend ? 'weekend' : ''}`}
                              style={{ height: `${barHeight}px` }}
                              title={`${day.date}: ${day.totalHours}h`}
                            >
                            </div>
                            <div className="trend-bar-labels">
                              <span className="trend-bar-day">{day.dayOfWeek}</span>
                              <span className="trend-bar-date">{day.dayOfMonth}</span>
                            </div>
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

            {/* Team Member Activity Table - Second */}
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
                            <div 
                              className="member-avatar"
                              style={{ backgroundColor: getAvatarColor(member.displayName) }}
                              title={member.displayName}
                            >
                              {getInitials(member.displayName)}
                            </div>
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
            <div className="issue-list-container">
              {teamAnalytics?.teamTimeByIssue?.length > 0 ? (
                <table className="issue-list-table">
                  <thead>
                    <tr>
                      <th className="issue-rank-header">#</th>
                      <th className="issue-key-header">Issue</th>
                      <th className="issue-time-header">Time Spent</th>
                      <th className="issue-progress-header">Distribution</th>
                      <th className="issue-members-header">Contributors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxSeconds = Math.max(...teamAnalytics.teamTimeByIssue.map(i => i.totalSeconds), 1);
                      return teamAnalytics.teamTimeByIssue.slice(0, 10).map((issue, idx) => {
                        const percentage = Math.round((issue.totalSeconds / maxSeconds) * 100);
                        return (
                          <tr key={idx} className="issue-list-row">
                            <td className="issue-rank-cell">
                              <span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span>
                            </td>
                            <td className="issue-key-cell">
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
                            </td>
                            <td className="issue-time-cell">
                              <span className="time-value">{formatTime(issue.totalSeconds)}</span>
                            </td>
                            <td className="issue-progress-cell">
                              <div className="progress-wrapper">
                                <div className="issue-bar-track">
                                  <div
                                    className={`issue-bar-fill rank-fill-${Math.min(idx + 1, 6)}`}
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <span className="progress-percentage">{percentage}%</span>
                              </div>
                            </td>
                            <td className="issue-members-cell">
                              <div className="contributors-badge">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 18.0609 15 17 15H7C5.93913 15 4.92172 15.4214 4.17157 16.1716C3.42143 16.9217 3 17.9391 3 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span>{issue.contributors}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
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
