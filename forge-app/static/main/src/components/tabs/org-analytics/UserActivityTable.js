import React from 'react';

/**
 * User Activity Table Component
 * Displays team member activity overview
 */
function UserActivityTable({ users = [] }) {
  const getTodayDateStr = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getWeekRangeStr = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(monday)} - ${formatDate(sunday)}, ${now.getFullYear()}`;
  };

  const getMonthStr = () => {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="user-activity-section">
      <div className="section-header">
        <h3>Team Activity Overview</h3>
        <span className="section-subtitle">Daily, weekly, and monthly hours by team member</span>
      </div>
      <div className="user-activity-table-container">
        <table className="user-activity-table">
          <thead>
            <tr>
              <th>User</th>
              <th>
                Today
                <span className="info-icon-wrapper">
                  <span className="info-icon">ℹ</span>
                  <span className="info-tooltip">{getTodayDateStr()}</span>
                </span>
              </th>
              <th>
                This Week
                <span className="info-icon-wrapper">
                  <span className="info-icon">ℹ</span>
                  <span className="info-tooltip">{getWeekRangeStr()}</span>
                </span>
              </th>
              <th>
                This Month
                <span className="info-icon-wrapper">
                  <span className="info-icon">ℹ</span>
                  <span className="info-tooltip">{getMonthStr()}</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-state">No user activity data available</td>
              </tr>
            ) : (
              users.map((user, idx) => (
                <tr key={idx}>
                  <td className="user-name-cell">
                    <span className="user-avatar">👤</span>
                    <span className="user-name">{user.displayName}</span>
                  </td>
                  <td className="hours-cell">
                    <strong>{user.todayHours}h</strong>
                  </td>
                  <td className="hours-cell">
                    <strong>{user.weekHours}h</strong>
                  </td>
                  <td className="hours-cell">
                    <strong>{user.monthHours}h</strong>
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

export default UserActivityTable;
