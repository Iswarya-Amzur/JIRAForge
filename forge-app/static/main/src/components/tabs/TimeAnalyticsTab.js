import React, { useState, useEffect } from 'react';
import { invoke, router } from '@forge/bridge';
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

  // Desktop app download URL from Supabase public storage (no expiration)
  const DESKTOP_APP_DOWNLOAD_URL = 'https://jvijitdewbypqbatfboi.supabase.co/storage/v1/object/public/desktop%20app/TimeTracker.exe';

  // Handle download button click using Forge router (required for sandbox)
  const handleDownloadClick = () => {
    router.open(DESKTOP_APP_DOWNLOAD_URL);
  };

  return (
    <div className="time-analytics">
      <h2>Time Analytics Dashboard</h2>

      {/* Desktop App Download Banner */}
      <div className="download-banner">
        <div className="download-banner-content">
          <div className="download-banner-text">
            <span className="download-banner-title">Timesheet Tracker</span>
            <span className="download-banner-subtitle">Download Timesheet Tracker</span>
          </div>
          <div className="download-banner-platforms">
            <div className="platform-option">
              <span className="platform-label">Windows</span>
              <button
                className="download-button"
                onClick={handleDownloadClick}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

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
