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
        <div className="card-icon" style={{ background: '#667eea' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div className="card-content">
          <h3>Today's Total</h3>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="cumulative-stat">
              <div className="stat-value">{formatTime(calculateTodayTotal())}</div>
            </div>
          )}
        </div>
      </div>

      <div className="analytics-card cumulative-card">
        <div className="card-icon" style={{ background: '#f5576c' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <div className="card-content">
          <h3>This Week's Total</h3>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="cumulative-stat">
              <div className="stat-value">{formatTime(calculateWeekTotal())}</div>
            </div>
          )}
        </div>
      </div>

      <div className="analytics-card cumulative-card">
        <div className="card-icon" style={{ background: '#4facfe' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        <div className="card-content">
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
    </div>
  );
}

export default SummaryCards;
