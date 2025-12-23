import React from 'react';

/**
 * Activity Trend Chart Component
 * Displays daily activity trend for the last 30 days
 */
function ActivityTrendChart({ dailySummary = [] }) {
  if (dailySummary.length === 0) {
    return (
      <div className="org-chart-card">
        <div className="chart-header">
          <h3>Organization Activity Trend</h3>
          <span className="chart-subtitle">Daily hours - Last 30 days</span>
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

  const sortedDates = Object.keys(dateAggregation).sort().slice(-30);
  const maxDailyHours = Math.max(...sortedDates.map(d => dateAggregation[d]), 1);

  return (
    <div className="org-chart-card">
      <div className="chart-header">
        <h3>Organization Activity Trend</h3>
        <span className="chart-subtitle">Daily hours - Last 30 days</span>
      </div>
      <div className="trend-chart">
        <div className="trend-bars">
          {sortedDates.map((dateStr, idx) => {
            const hours = dateAggregation[dateStr];
            const height = (hours / maxDailyHours) * 100;
            const date = new Date(dateStr + 'T00:00:00');
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <div
                key={idx}
                className={`trend-bar ${isWeekend ? 'weekend' : ''}`}
                title={`${dateStr}: ${Math.round(hours * 10) / 10}h`}
              >
                <div
                  className="trend-bar-fill"
                  style={{ height: `${Math.max(height, 2)}%` }}
                ></div>
                {idx % 5 === 0 && (
                  <span className="trend-bar-label">{date.getDate()}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ActivityTrendChart;
