import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { useApp } from '../../context';
import { SummaryCards, DayView, WeekView, MonthView } from './time-analytics';
import './TimeAnalyticsTab.css';

/**
 * Time Analytics Tab Component
 * Orchestrates the different timesheet views (Day, Week, Month)
 */
function TimeAnalyticsTab() {
  const { userPermissions } = useApp();

  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);
  const [timeData, setTimeData] = useState(null);
  const [timesheetView, setTimesheetView] = useState('day');
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    loadTimeAnalytics();
  }, []);

  const loadTimeAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getTimeAnalytics');
      if (result.success) {
        setTimeData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load time analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="time-analytics">
      <h2>Time Analytics Dashboard</h2>

      <SummaryCards loading={loading} timeData={timeData} />

      {/* Timesheet View Tabs */}
      <div className="timesheet-tabs">
        <button
          className={`timesheet-tab ${timesheetView === 'day' ? 'active' : ''}`}
          onClick={() => setTimesheetView('day')}
        >
          Day
        </button>
        <button
          className={`timesheet-tab ${timesheetView === 'week' ? 'active' : ''}`}
          onClick={() => setTimesheetView('week')}
        >
          Week
        </button>
        <button
          className={`timesheet-tab ${timesheetView === 'month' ? 'active' : ''}`}
          onClick={() => setTimesheetView('month')}
        >
          Month
        </button>
      </div>

      {/* Timesheet Content */}
      <div className="timesheet-content">
        {timesheetView === 'day' && (
          <DayView loading={loading} timeData={timeData} />
        )}

        {timesheetView === 'week' && (
          <WeekView loading={loading} timeData={timeData} />
        )}

        {timesheetView === 'month' && (
          <MonthView
            loading={loading}
            timeData={timeData}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            userPermissions={userPermissions}
          />
        )}
      </div>
    </div>
  );
}

export default TimeAnalyticsTab;
