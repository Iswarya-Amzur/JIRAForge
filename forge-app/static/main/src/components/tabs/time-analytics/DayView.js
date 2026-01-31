import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import { formatTime } from '../../../utils';
import { normalizeDate, formatLocalDate } from './dateUtils';

/**
 * Day View Component
 * Displays today's timesheet with team member cards and activity timeline
 */
function DayView({ loading, timeData }) {
  const [timelineData, setTimelineData] = useState(null);
  const [myTimelineData, setMyTimelineData] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
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

  // Fetch timeline data for today
  useEffect(() => {
    const fetchTimeline = async () => {
      setTimelineLoading(true);
      try {
        if (timeData?.canViewAllUsers) {
          // Admin: fetch all users' timeline
          const result = await invoke('getTeamDayTimeline', { 
            projectKey: null, // All projects
            date: todayStr 
          });
          if (result.success) {
            setTimelineData(result.data);
          }
        } else {
          // Regular user: fetch only their own timeline
          const result = await invoke('getMyDayTimeline', { 
            date: todayStr 
          });
          if (result.success) {
            setMyTimelineData(result.data);
          }
        }
      } catch (err) {
        console.error('Failed to load timeline:', err);
      } finally {
        setTimelineLoading(false);
      }
    };

    if (timeData && !loading) {
      fetchTimeline();
    }
  }, [timeData, loading, todayStr]);

  // Timeline hours to display (6am to 8pm)
  const timelineHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  // Build hourly activity slots from timeline data for a specific user
  const getUserTimelineSlots = (userId) => {
    // For admins, use team timeline data
    if (timeData?.canViewAllUsers && timelineData) {
      const userTimeline = timelineData.usersWithActivity?.find(u => u.userId === userId);
      if (!userTimeline || !userTimeline.sessions || userTimeline.sessions.length === 0) {
        return null;
      }

      // Create slots for each half-hour
      const slots = Array(48).fill(false);
      userTimeline.sessions.forEach(session => {
        const slotIndex = session.hour * 2 + (session.minute >= 30 ? 1 : 0);
        if (slotIndex >= 0 && slotIndex < 48) {
          slots[slotIndex] = true;
        }
      });

      return slots;
    }
    
    // For regular users, use their own timeline data
    if (myTimelineData && myTimelineData.sessions && myTimelineData.sessions.length > 0) {
      const slots = Array(48).fill(false);
      myTimelineData.sessions.forEach(session => {
        const slotIndex = session.hour * 2 + (session.minute >= 30 ? 1 : 0);
        if (slotIndex >= 0 && slotIndex < 48) {
          slots[slotIndex] = true;
        }
      });
      return slots;
    }
    
    return null;
  };

  // Get last activity info for a user
  const getUserLastActivity = (userId) => {
    // For admins, use team timeline data
    if (timeData?.canViewAllUsers && timelineData) {
      const userTimeline = timelineData.usersWithActivity?.find(u => u.userId === userId);
      return userTimeline?.lastActivity || null;
    }
    
    // For regular users, use their own timeline data
    if (myTimelineData) {
      return myTimelineData.lastActivity || null;
    }
    
    return null;
  };

  // Check if timeline is available (for admins or regular user)
  const hasTimelineData = () => {
    if (timeData?.canViewAllUsers) {
      return timelineData !== null;
    }
    return myTimelineData !== null;
  };

  // Format time of day (e.g., "2:30 PM")
  const formatTimeOfDay = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Calculate time ago
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return null;
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return null;
  };

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

            return (
              <>
                {/* Timeline Header - show if we have timeline data (admin or regular user) */}
                {hasTimelineData() && (
                  <div className="day-timeline-header">
                    <div className="timeline-header-name">Name</div>
                    <div className="timeline-header-hours">
                      {timelineHours.map(hour => (
                        <span key={hour} className="timeline-hour-label">
                          {hour === 12 ? '12pm' : hour > 12 ? `${hour-12}pm` : `${hour}am`}
                        </span>
                      ))}
                    </div>
                    <div className="timeline-header-total"></div>
                  </div>
                )}

                {users.map((user, idx) => {
                  const slots = getUserTimelineSlots(user.userId);
                  const lastActivity = getUserLastActivity(user.userId);
                  const timeAgo = lastActivity ? getTimeAgo(lastActivity) : null;
                  const hasActivity = user.totalSeconds > 0;
                  const showTimeline = hasTimelineData();

                  return (
                    <div key={idx} className={`team-member-card ${showTimeline ? 'with-timeline' : ''}`}>
                      <div className="member-header">
                        {/* Avatar with status indicator */}
                        <div className="member-avatar-wrapper">
                          <div 
                            className="member-avatar"
                            style={{ backgroundColor: getAvatarColor(user.displayName) }}
                            title={user.displayName}
                          >
                            {getInitials(user.displayName)}
                          </div>
                          {hasActivity && (
                            <span className="member-status-dot active" title="Active today"></span>
                          )}
                        </div>

                        {/* Name and subtitle */}
                        <div className="member-name-section">
                          <span className="member-name">{user.displayName}</span>
                          {showTimeline && (
                            <span className="member-subtitle">
                              {hasActivity && timeAgo ? (
                                `Last Tracked: ${timeAgo}`
                              ) : !hasActivity ? (
                                <span className="no-activity-today">No activity today</span>
                              ) : null}
                            </span>
                          )}
                        </div>

                        {/* Timeline visualization - for both admins and regular users */}
                        {showTimeline && (
                          <div className="member-timeline">
                            {slots ? (
                              <div className="timeline-bars">
                                {timelineHours.map(hour => {
                                  const slot1 = slots[hour * 2];
                                  const slot2 = slots[hour * 2 + 1];
                                  return (
                                    <div key={hour} className="timeline-hour-cell">
                                      <div className={`timeline-slot ${slot1 ? 'active' : ''}`}></div>
                                      <div className={`timeline-slot ${slot2 ? 'active' : ''}`}></div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="timeline-bars empty">
                                {timelineHours.map(hour => (
                                  <div key={hour} className="timeline-hour-cell">
                                    <div className="timeline-slot"></div>
                                    <div className="timeline-slot"></div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Time total */}
                        <div className="member-total-section">
                          <span className="member-total">{formatTime(user.totalSeconds)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default DayView;
