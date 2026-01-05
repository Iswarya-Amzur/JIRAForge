import React from 'react';
import { formatTime } from '../../../utils';
import { normalizeDate, formatLocalDate, getMonthStr } from './dateUtils';

/**
 * Summary Cards Component
 * Displays Today's, Week's, and Month's total time
 */
function SummaryCards({ loading, timeData }) {
  const calculateTodayTotal = () => {
    const today = new Date();
    const todayStr = formatLocalDate(today);

    return timeData?.dailySummary?.filter(day => {
      const workDateStr = normalizeDate(day.work_date);
      return workDateStr === todayStr;
    }).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
  };

  const calculateWeekTotal = () => {
    const today = new Date();
    const todayStr = formatLocalDate(today);

    // Calculate start of week (Monday) - ISO week standard, consistent with Team Analytics
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay();
    // If Sunday (0), go back 6 days. Otherwise, go back (dayOfWeek - 1) days.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(today.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Build array of date strings for this week up to today
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const weekDate = new Date(startOfWeek);
      weekDate.setDate(startOfWeek.getDate() + i);
      return formatLocalDate(weekDate);
    }).filter(dateStr => dateStr <= todayStr);

    return timeData?.dailySummary?.filter(day => {
      const workDateStr = normalizeDate(day.work_date);
      return weekDates.includes(workDateStr);
    }).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
  };

  const calculateMonthTotal = () => {
    const currentMonth = getMonthStr();

    return timeData?.dailySummary?.filter(day => {
      const workDateStr = normalizeDate(day.work_date);
      return workDateStr.startsWith(currentMonth);
    }).reduce((sum, day) => sum + (day.total_seconds || 0), 0) || 0;
  };

  return (
    <div className="analytics-summary-cards">
      <div className="analytics-card cumulative-card">
        <h3>Today's Total</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="cumulative-stat">
            <div className="stat-value">{formatTime(calculateTodayTotal())}</div>
          </div>
        )}
      </div>

      <div className="analytics-card cumulative-card">
        <h3>This Week's Total</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="cumulative-stat">
            <div className="stat-value">{formatTime(calculateWeekTotal())}</div>
          </div>
        )}
      </div>

      <div className="analytics-card cumulative-card">
        <h3>This Month's Total</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="cumulative-stat">
            <div className="stat-value">{formatTime(calculateMonthTotal())}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SummaryCards;
