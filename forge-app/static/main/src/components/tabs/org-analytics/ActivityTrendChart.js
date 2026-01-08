import React from 'react';

/**
 * Activity Trend Chart Component
 * Displays daily activity trend for the last 14 days
 */
function ActivityTrendChart({ dailySummary = [] }) {
  if (dailySummary.length === 0) {
    return (
      <div className="org-chart-card">
        <div className="chart-header">
          <div className="chart-title-row">
            <h3>Activity Trend</h3>
            <div className="chart-info-wrapper">
              <span className="chart-info-icon">i</span>
              <span className="chart-info-tooltip">
                Daily work hours across the entire organization for the last 14 days. Taller bars represent more hours tracked on that day.
              </span>
            </div>
          </div>
          <span className="chart-subtitle">Daily team hours - Last 14 days</span>
        </div>
        <div className="trend-chart">
          <p className="empty-state">No activity data available</p>
        </div>
      </div>
    );
  }

  // Aggregate data by date
  const dateAggregation = {};
  dailySummary.forEach(day => {
    const dateStr = typeof day.work_date === 'string'
      ? day.work_date.split('T')[0]
      : String(day.work_date);
    if (!dateAggregation[dateStr]) {
      dateAggregation[dateStr] = 0;
    }
    dateAggregation[dateStr] += (day.total_seconds || 0) / 3600;
  });

  const sortedDates = Object.keys(dateAggregation).sort().slice(-14);
  const maxDailyHours = Math.max(...sortedDates.map(d => dateAggregation[d]), 1);

  const maxBarHeight = 160; // Fixed pixel height for the tallest bar

  return (
    <div className="org-chart-card">
      <div className="chart-header">
        <div className="chart-title-row">
          <h3>Activity Trend</h3>
          <div className="chart-info-wrapper">
            <span className="chart-info-icon">i</span>
            <span className="chart-info-tooltip">
              Daily work hours across the entire organization for the last 14 days. Taller bars represent more hours tracked on that day.
            </span>
          </div>
        </div>
        <span className="chart-subtitle">Daily team hours - Last 14 days</span>
      </div>
      <div className="trend-chart">
        <div className="trend-bars">
          {sortedDates.map((dateStr, idx) => {
            const hours = dateAggregation[dateStr];
            // Calculate bar height in pixels (minimum 8px if there's any value)
            const barHeight = hours > 0
              ? Math.max(8, Math.round((hours / maxDailyHours) * maxBarHeight))
              : 0;
            const date = new Date(dateStr + 'T00:00:00');
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dayOfMonth = date.getDate();

            return (
              <div key={idx} className="trend-bar-wrapper">
                <span className="trend-bar-value">{hours > 0 ? `${Math.round(hours * 10) / 10}h` : ''}</span>
                <div
                  className={`trend-bar ${hours === 0 ? 'empty-bar' : ''} ${isWeekend ? 'weekend' : ''}`}
                  style={{ height: `${barHeight}px` }}
                  title={`${dayOfWeek}, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${Math.round(hours * 10) / 10}h`}
                >
                </div>
                <div className="trend-bar-labels">
                  <span className="trend-bar-day">{dayOfWeek}</span>
                  <span className="trend-bar-date">{dayOfMonth}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ActivityTrendChart;
