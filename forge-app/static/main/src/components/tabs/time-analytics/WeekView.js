import React from 'react';
import { formatTime } from '../../../utils';
import { normalizeDate, formatLocalDate, getWeekDates } from './dateUtils';

/**
 * Week View Component
 * Displays weekly timesheet with table layout
 */
function WeekView({ loading, timeData }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatLocalDate(today);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const weekDates = getWeekDates(today);
  const daysCount = weekDates.length;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getWeekStartDate = () => {
    return startOfWeek.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getUserTimeByDay = () => {
    const userTimeByDay = {};

    // Initialize with all known users
    timeData?.allUsers?.forEach(user => {
      userTimeByDay[user.id] = {
        userId: user.id,
        name: user.display_name || user.email || 'User',
        days: Array(daysCount).fill(0),
        total: 0
      };
    });

    // Aggregate daily data by user
    timeData?.dailySummary?.forEach(day => {
      const workDateStr = normalizeDate(day.work_date);
      const weekDateItem = weekDates.find(item => item.dateStr === workDateStr);

      if (weekDateItem && workDateStr <= todayStr) {
        const userId = day.user_id || 'current_user';
        const dayIndex = weekDates.indexOf(weekDateItem);

        if (!userTimeByDay[userId]) {
          userTimeByDay[userId] = {
            userId,
            name: day.user_display_name || 'User',
            days: Array(daysCount).fill(0),
            total: 0
          };
        }
        if (dayIndex >= 0 && dayIndex < daysCount) {
          userTimeByDay[userId].days[dayIndex] += day.total_seconds || 0;
          userTimeByDay[userId].total += day.total_seconds || 0;
        }
      }
    });

    return Object.values(userTimeByDay).sort((a, b) => b.total - a.total);
  };

  return (
    <div className="timesheet-week-view">
      <div className="timesheet-header">
        <h3>
          {timeData?.canViewAllUsers ? 'Weekly Timesheet' : 'My Weekly Timesheet'} - Week of {getWeekStartDate()}
        </h3>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="week-table-container">
          <table className="week-table">
            <thead>
              <tr>
                <th>{timeData?.canViewAllUsers ? 'Team Member' : 'User'}</th>
                {weekDates.map((item, i) => (
                  <th key={i}>{dayNames[item.date.getDay()]}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const users = getUserTimeByDay();

                if (users.length === 0) {
                  return (
                    <tr>
                      <td colSpan={daysCount + 2} className="empty-state">No users found</td>
                    </tr>
                  );
                }

                return (
                  <>
                    {users.map((user, idx) => (
                      <tr key={idx}>
                        <td className="member-name-cell">
                          <div className="member-avatar-small">
                            {user.name.charAt(0)}
                          </div>
                          {user.name}
                        </td>
                        {user.days.map((seconds, dayIdx) => (
                          <td key={dayIdx} className="time-cell">
                            {seconds > 0 ? formatTime(seconds) : '-'}
                          </td>
                        ))}
                        <td className="total-cell">{formatTime(user.total)}</td>
                      </tr>
                    ))}
                    {timeData?.canViewAllUsers && users.length > 1 && (
                      <tr className="totals-row">
                        <td><strong>Daily Totals</strong></td>
                        {Array.from({ length: daysCount }, (_, dayIdx) => {
                          const dayTotal = users.reduce((sum, user) => sum + user.days[dayIdx], 0);
                          return (
                            <td key={dayIdx} className="total-cell">
                              {dayTotal > 0 ? formatTime(dayTotal) : '-'}
                            </td>
                          );
                        })}
                        <td className="grand-total-cell">
                          {formatTime(users.reduce((sum, user) => sum + user.total, 0))}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default WeekView;
