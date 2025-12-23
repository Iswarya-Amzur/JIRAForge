import React from 'react';
import { formatTime } from '../../../utils';
import { normalizeDate, getMonthStr } from './dateUtils';

/**
 * Month View Component
 * Displays monthly calendar and team summary
 */
function MonthView({ loading, timeData, selectedMonth, setSelectedMonth, userPermissions }) {
  const today = new Date();
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const selectedMonthStr = getMonthStr(selectedMonth);

  const navigatePrevMonth = () => {
    setSelectedMonth(new Date(year, month - 1, 1));
  };

  const navigateNextMonth = () => {
    setSelectedMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setSelectedMonth(new Date());
  };

  const getTimeByDate = () => {
    const timeByDate = {};
    timeData?.dailySummary?.forEach(day => {
      const workDateStr = normalizeDate(day.work_date);
      if (workDateStr.startsWith(selectedMonthStr)) {
        const date = new Date(workDateStr + 'T00:00:00');
        if (date.getMonth() === month && date.getFullYear() === year) {
          const dayNum = date.getDate();
          timeByDate[dayNum] = (timeByDate[dayNum] || 0) + (day.total_seconds || 0);
        }
      }
    });
    return timeByDate;
  };

  const getUserMonthlyTime = () => {
    const userMonthlyTime = {};

    // Initialize with all known users
    timeData?.allUsers?.forEach(user => {
      userMonthlyTime[user.id] = {
        userId: user.id,
        name: user.display_name || user.email || 'User',
        seconds: 0
      };
    });

    // Aggregate monthly data by user
    timeData?.dailySummary?.forEach(day => {
      const workDateStr = normalizeDate(day.work_date);
      if (workDateStr && workDateStr.startsWith(selectedMonthStr)) {
        const userId = day.user_id || 'current_user';
        if (!userMonthlyTime[userId]) {
          userMonthlyTime[userId] = {
            userId,
            name: day.user_display_name || 'User',
            seconds: 0
          };
        }
        userMonthlyTime[userId].seconds += day.total_seconds || 0;
      }
    });

    const totalSeconds = Object.values(userMonthlyTime).reduce((sum, u) => sum + u.seconds, 0);

    return Object.values(userMonthlyTime)
      .map(user => ({
        ...user,
        percentage: totalSeconds > 0 ? Math.round((user.seconds / totalSeconds) * 100) : 0
      }))
      .sort((a, b) => b.seconds - a.seconds);
  };

  const renderCalendar = () => {
    const firstDayOfMonth = new Date(year, month, 1);
    let firstDay = firstDayOfMonth.getDay() - 1;
    if (firstDay < 0) firstDay = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const timeByDate = getTimeByDate();

    const rows = [];
    let day = 1;
    const totalWeeks = Math.ceil((firstDay + daysInMonth) / 7);

    for (let week = 0; week < totalWeeks; week++) {
      const cells = [];
      for (let weekDay = 0; weekDay < 7; weekDay++) {
        const dayIndex = week * 7 + weekDay;
        if (dayIndex < firstDay || day > daysInMonth) {
          cells.push(<td key={weekDay} className="calendar-cell empty"></td>);
        } else {
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isWeekend = weekDay >= 5;
          const timeTracked = timeByDate[day] || 0;
          const currentDay = day;

          cells.push(
            <td
              key={weekDay}
              className={`calendar-cell ${isToday ? 'today' : ''} ${timeTracked > 0 ? 'has-time' : ''} ${isWeekend ? 'weekend' : ''}`}
            >
              <div className="cell-day">{currentDay}</div>
              {timeTracked > 0 && (
                <div className="cell-time">{formatTime(timeTracked)}</div>
              )}
            </td>
          );
          day++;
        }
      }
      rows.push(<tr key={week}>{cells}</tr>);
    }

    return rows;
  };

  const canViewTeamSummary = userPermissions.isJiraAdmin || userPermissions.projectAdminProjects?.length > 0;

  return (
    <div className="timesheet-month-view">
      <div className="month-header-container">
        <div className="month-nav">
          <button className="month-nav-btn" onClick={navigatePrevMonth}>
            <span className="nav-arrow">&#8249;</span>
          </button>
          <div className="month-title-wrapper">
            <h3 className="month-title">
              {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <span className="month-subtitle">
              {timeData?.canViewAllUsers ? 'Team Timesheet' : 'My Timesheet'}
            </span>
          </div>
          <button className="month-nav-btn" onClick={navigateNextMonth}>
            <span className="nav-arrow">&#8250;</span>
          </button>
        </div>
        <button className="today-btn" onClick={goToToday}>
          Today
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading timesheet...</p>
        </div>
      ) : (
        <div className="month-layout">
          <div className="month-calendar-card">
            <div className="calendar-card-header">
              <h4>Calendar View</h4>
            </div>
            <table className="calendar-table">
              <thead>
                <tr>
                  <th>Mon</th>
                  <th>Tue</th>
                  <th>Wed</th>
                  <th>Thu</th>
                  <th>Fri</th>
                  <th className="weekend">Sat</th>
                  <th className="weekend">Sun</th>
                </tr>
              </thead>
              <tbody>{renderCalendar()}</tbody>
            </table>
          </div>

          {canViewTeamSummary && (
            <div className="team-summary">
              <h4>Team Summary</h4>
              <div className="team-summary-list">
                {(() => {
                  const users = getUserMonthlyTime();

                  if (users.length === 0) {
                    return <p className="empty-state">No users found</p>;
                  }

                  return users.map((user, idx) => (
                    <div key={idx} className="team-summary-item">
                      <div className="summary-member">
                        <div className="member-avatar-small">
                          {user.name.charAt(0)}
                        </div>
                        <div className="summary-info">
                          <div className="summary-name">{user.name}</div>
                          <div className="summary-time">{formatTime(user.seconds)}</div>
                        </div>
                      </div>
                      <div className="summary-percentage">{user.percentage}%</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MonthView;
