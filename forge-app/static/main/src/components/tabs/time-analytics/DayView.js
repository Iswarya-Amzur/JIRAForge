import React from 'react';
import { formatTime } from '../../../utils';
import { normalizeDate, formatLocalDate } from './dateUtils';

/**
 * Day View Component
 * Displays today's timesheet with team member cards
 */
function DayView({ loading, timeData }) {
  // Helper function to get user initials
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Helper function to generate consistent avatar colors
  const getAvatarColor = (name) => {
    const colors = [
      '#0052CC', // Blue
      '#00875A', // Green
      '#FF5630', // Red
      '#6554C0', // Purple
      '#FF991F', // Orange
      '#00B8D9', // Cyan
      '#36B37E', // Teal
      '#FFAB00', // Yellow
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  const today = new Date();
  const todayStr = formatLocalDate(today);

  const getTodayData = () => {
    return timeData?.dailySummary?.filter(day => {
      const workDateStr = normalizeDate(day.work_date);
      return workDateStr === todayStr;
    }) || [];
  };

  const getUsers = () => {
    const todayData = getTodayData();
    const tasksByUser = {};

    // Initialize with all known users
    timeData?.allUsers?.forEach(user => {
      tasksByUser[user.id] = {
        userId: user.id,
        displayName: user.display_name || user.email || 'User',
        tasks: [],
        totalSeconds: 0
      };
    });

    // Aggregate today's data by user
    todayData.forEach(item => {
      const userId = item.user_id || 'current_user';
      if (!tasksByUser[userId]) {
        tasksByUser[userId] = {
          userId,
          displayName: item.user_display_name || 'User',
          tasks: [],
          totalSeconds: 0
        };
      }
      tasksByUser[userId].tasks.push(item);
      tasksByUser[userId].totalSeconds += item.total_seconds || 0;
    });

    return Object.values(tasksByUser).sort((a, b) => b.totalSeconds - a.totalSeconds);
  };

  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="timesheet-day-view">
      <div className="timesheet-header">
        <h3>
          {timeData?.canViewAllUsers ? 'Daily Timesheet' : 'My Daily Timesheet'} - {formattedDate}
        </h3>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="team-members-list">
          {(() => {
            const users = getUsers();

            if (users.length === 0) {
              return <p className="empty-state">No users found</p>;
            }

            return users.map((user, idx) => (
              <div key={idx} className="team-member-card">
                <div className="member-header">
                  <div 
                    className="member-avatar"
                    style={{ backgroundColor: getAvatarColor(user.displayName) }}
                    title={user.displayName}
                  >
                    {getInitials(user.displayName)}
                  </div>
                  <div className="member-info">
                    <span className="member-name">{user.displayName}</span>
                    <span className="member-total">{formatTime(user.totalSeconds)}</span>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

export default DayView;
