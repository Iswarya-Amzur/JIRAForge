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
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();
    const todayStr = formatLocalDate(today);
    const startOfWeek = new Date(year, month, date - today.getDay());

    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const weekDate = new Date(year, month, startOfWeek.getDate() + i);
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
