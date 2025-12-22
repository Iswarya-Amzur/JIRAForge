/**
 * Analytics Service
 * Business logic for time tracking analytics
 */

import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, getUserOrganizationMembership, supabaseRequest } from '../utils/supabase.js';
import { isJiraAdmin, checkUserPermissions, getAllJiraProjectKeys } from '../utils/jira.js';
import { MAX_DAILY_SUMMARY_DAYS, MAX_WEEKLY_SUMMARY_WEEKS, MAX_ISSUES_IN_ANALYTICS } from '../config/constants.js';

/**
 * Fetch time analytics data for a user
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @returns {Promise<Object>} Analytics data (daily, weekly, by project, by issue)
 */
export async function fetchTimeAnalytics(accountId, cloudId) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  // Get or create organization first
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Check if user is admin or project admin in Jira
  const isAdmin = await isJiraAdmin();
  const permissions = await checkUserPermissions(['ADMINISTER_PROJECTS']);
  const isProjectAdmin = permissions.permissions?.ADMINISTER_PROJECTS?.havePermission;

  // Also check organization-level permissions
  const membership = await getUserOrganizationMembership(userId, organization.id, supabaseConfig);
  const canViewTeamAnalytics = membership?.can_view_team_analytics || false;

  // User can view all users if Jira admin, project admin, OR has organization permission
  const canViewAllUsers = isAdmin || isProjectAdmin || canViewTeamAnalytics;

  // Fetch daily summary - filter by organization_id, and by user if not admin
  const dailySummaryQuery = canViewAllUsers
    ? `daily_time_summary?organization_id=eq.${organization.id}&order=work_date.desc&limit=${MAX_DAILY_SUMMARY_DAYS}`
    : `daily_time_summary?user_id=eq.${userId}&organization_id=eq.${organization.id}&order=work_date.desc&limit=${MAX_DAILY_SUMMARY_DAYS}`;

  const dailySummary = await supabaseRequest(supabaseConfig, dailySummaryQuery);

  // Fetch weekly summary
  const weeklySummaryQuery = canViewAllUsers
    ? `weekly_time_summary?organization_id=eq.${organization.id}&order=week_start.desc&limit=${MAX_WEEKLY_SUMMARY_WEEKS}`
    : `weekly_time_summary?user_id=eq.${userId}&organization_id=eq.${organization.id}&order=week_start.desc&limit=${MAX_WEEKLY_SUMMARY_WEEKS}`;

  const weeklySummary = await supabaseRequest(supabaseConfig, weeklySummaryQuery);

  // Fetch project time summary
  // Note: project_time_summary is aggregated by project (not by user), so we filter by organization only
  // For user-specific project data, we aggregate from daily_time_summary instead
  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?organization_id=eq.${organization.id}&order=total_seconds.desc`
  );

  // Fetch time by issue (from analysis_results with screenshots) - includes all work types for total
  // Note: We include all work types here because we want total time per issue
  // Updated to use screenshots.duration_seconds instead of analysis_results.time_spent_seconds
  const timeByIssueQuery = canViewAllUsers
    ? `analysis_results?organization_id=eq.${organization.id}&active_task_key=not.is.null&select=active_task_key,active_project_key,work_type,screenshots(duration_seconds)&order=created_at.desc`
    : `analysis_results?user_id=eq.${userId}&organization_id=eq.${organization.id}&active_task_key=not.is.null&select=active_task_key,active_project_key,work_type,screenshots(duration_seconds)&order=created_at.desc`;

  const timeByIssue = await supabaseRequest(supabaseConfig, timeByIssueQuery);

  // Aggregate time by issue
  const issueAggregation = {};
  timeByIssue.forEach(result => {
    const key = result.active_task_key;
    if (!issueAggregation[key]) {
      issueAggregation[key] = {
        issueKey: key,
        projectKey: result.active_project_key,
        totalSeconds: 0
      };
    }
    // Use screenshots.duration_seconds instead of time_spent_seconds
    issueAggregation[key].totalSeconds += result.screenshots?.duration_seconds || 0;
  });

  const timeByIssueArray = Object.values(issueAggregation)
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, MAX_ISSUES_IN_ANALYTICS);

  // Fetch all active users for team view - filter by organization
  let allUsers = [];
  if (canViewAllUsers) {
    allUsers = await supabaseRequest(
      supabaseConfig,
      `users?organization_id=eq.${organization.id}&is_active=eq.true&select=id,display_name,email`
    );
  } else {
    // For regular users, only include themselves
    const currentUser = await supabaseRequest(
      supabaseConfig,
      `users?id=eq.${userId}&select=id,display_name,email`
    );
    allUsers = currentUser || [];
  }

  return {
    dailySummary: dailySummary || [],
    weeklySummary: weeklySummary || [],
    timeByProject: timeByProject || [],
    timeByIssue: timeByIssueArray,
    allUsers: allUsers || [],
    canViewAllUsers, // Pass this to frontend so it knows how to display
    organizationId: organization.id,
    organizationName: organization.org_name
  };
}
/**
 * Fetch all analytics data (Admin only)
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @returns {Promise<Object>} All analytics data
 */
export async function fetchAllAnalytics(accountId, cloudId) {
  // 1. Check Admin Permission
  const isAdmin = await isJiraAdmin();
  if (!isAdmin) {
    throw new Error('Access denied: Requires Jira Administrator permission');
  }

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured');
  }

  // Get organization
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  // 2. Fetch All Data - filter by organization_id for multi-tenancy
  // Daily Summary (All Users in this organization) - Get 60 days for comparison
  const dailySummary = await supabaseRequest(
    supabaseConfig,
    `daily_time_summary?organization_id=eq.${organization.id}&order=work_date.desc&limit=60`
  );

  // Project Summary (All Projects in this organization)
  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?organization_id=eq.${organization.id}&order=total_seconds.desc`
  );

  // Get all users in organization for adoption metrics and user activity
  const allUsers = await supabaseRequest(
    supabaseConfig,
    `users?organization_id=eq.${organization.id}&select=id,display_name,email,is_active`
  );

  // Get unique active users who tracked time this month
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const currentMonthStr = formatDate(currentMonthStart);
  const lastMonthStartStr = formatDate(lastMonthStart);
  const lastMonthEndStr = formatDate(lastMonthEnd);

  // Calculate this month's metrics
  const thisMonthData = (dailySummary || []).filter(day => {
    const workDate = typeof day.work_date === 'string' ? day.work_date.split('T')[0] : String(day.work_date);
    return workDate >= currentMonthStr;
  });

  // Calculate last month's metrics
  const lastMonthData = (dailySummary || []).filter(day => {
    const workDate = typeof day.work_date === 'string' ? day.work_date.split('T')[0] : String(day.work_date);
    return workDate >= lastMonthStartStr && workDate <= lastMonthEndStr;
  });

  // Total hours this month
  const totalSecondsThisMonth = thisMonthData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
  const totalHoursThisMonth = Math.round(totalSecondsThisMonth / 3600 * 10) / 10;

  // Total hours last month
  const totalSecondsLastMonth = lastMonthData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
  const totalHoursLastMonth = Math.round(totalSecondsLastMonth / 3600 * 10) / 10;

  // Calculate % change
  const hoursChange = totalHoursLastMonth > 0
    ? Math.round((totalHoursThisMonth - totalHoursLastMonth) / totalHoursLastMonth * 100)
    : 0;

  // Unique active users this month
  const activeUsersThisMonth = new Set(thisMonthData.map(d => d.user_id)).size;
  const activeUsersLastMonth = new Set(lastMonthData.map(d => d.user_id)).size;
  const activeUsersChange = activeUsersThisMonth - activeUsersLastMonth;

  // Total users and adoption rate
  const totalUsers = (allUsers || []).filter(u => u.is_active !== false).length;
  const adoptionRate = totalUsers > 0 ? Math.round(activeUsersThisMonth / totalUsers * 100) : 0;

  // Fetch actual Jira projects to filter out invalid/stale project keys
  const validJiraProjectKeys = await getAllJiraProjectKeys();
  console.log('[Analytics] Valid Jira project keys:', Array.from(validJiraProjectKeys));

  // Active projects this month - only count valid Jira projects
  const activeProjectsThisMonth = new Set(
    thisMonthData
      .map(d => d.project_key)
      .filter(key => key && validJiraProjectKeys.has(key))
  ).size;
  const activeProjectsLastMonth = new Set(
    lastMonthData
      .map(d => d.project_key)
      .filter(key => key && validJiraProjectKeys.has(key))
  ).size;
  const projectsChange = activeProjectsThisMonth - activeProjectsLastMonth;

  // Build project portfolio with contributor counts and trends
  // Filter to only include projects that exist in Jira
  const projectPortfolio = (timeByProject || [])
    .filter(project => {
      const isValid = validJiraProjectKeys.has(project.project_key);
      if (!isValid) {
        console.log(`[Analytics] Filtering out invalid project: ${project.project_key}`);
      }
      return isValid;
    })
    .map(project => {
    // Get this month's data for the project
    const projectThisMonth = thisMonthData.filter(d => d.project_key === project.project_key);
    const projectLastMonth = lastMonthData.filter(d => d.project_key === project.project_key);

    const hoursThisMonth = projectThisMonth.reduce((sum, d) => sum + (d.total_seconds || 0), 0) / 3600;
    const hoursLastMonth = projectLastMonth.reduce((sum, d) => sum + (d.total_seconds || 0), 0) / 3600;

    const trendPercent = hoursLastMonth > 0
      ? Math.round((hoursThisMonth - hoursLastMonth) / hoursLastMonth * 100)
      : (hoursThisMonth > 0 ? 100 : 0);

    // Count unique contributors
    const contributorCount = new Set(projectThisMonth.map(d => d.user_id)).size;

    // Count unique issues worked on
    const issueCount = new Set(projectThisMonth.map(d => d.active_task_key).filter(Boolean)).size;

    // Determine status based on trend
    let status = 'healthy';
    if (trendPercent < -20) status = 'critical';
    else if (trendPercent < 0) status = 'warning';

    return {
      projectKey: project.project_key,
      totalHours: Math.round(hoursThisMonth * 10) / 10,
      totalSeconds: project.total_seconds || 0,
      contributorCount,
      issueCount,
      trendPercent,
      status
    };
  }).filter(p => p.totalHours > 0 || p.totalSeconds > 0);

  // Build org summary
  const orgSummary = {
    totalHours: totalHoursThisMonth,
    totalHoursChange: hoursChange,
    activeProjects: activeProjectsThisMonth,
    projectsChange: projectsChange,
    activeUsers: activeUsersThisMonth,
    activeUsersChange: activeUsersChange,
    totalUsers: totalUsers,
    adoptionRate: adoptionRate
  };

  // Calculate user activity (today, this week, this month)
  const todayStr = formatDate(now);

  // Calculate week start (Monday)
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so go back 6 days
  weekStart.setDate(weekStart.getDate() - daysToMonday);
  const weekStartStr = formatDate(weekStart);

  // Build user activity data
  const userActivity = (allUsers || [])
    .filter(user => user.is_active !== false)
    .map(user => {
      // Filter daily summary for this user
      const userDailyData = (dailySummary || []).filter(d => d.user_id === user.id);

      // Today's hours
      const todayData = userDailyData.filter(d => {
        const workDate = typeof d.work_date === 'string' ? d.work_date.split('T')[0] : String(d.work_date);
        return workDate === todayStr;
      });
      const todaySeconds = todayData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
      const todayHours = Math.round(todaySeconds / 3600 * 10) / 10;

      // This week's hours
      const weekData = userDailyData.filter(d => {
        const workDate = typeof d.work_date === 'string' ? d.work_date.split('T')[0] : String(d.work_date);
        return workDate >= weekStartStr && workDate <= todayStr;
      });
      const weekSeconds = weekData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
      const weekHours = Math.round(weekSeconds / 3600 * 10) / 10;

      // This month's hours
      const monthData = userDailyData.filter(d => {
        const workDate = typeof d.work_date === 'string' ? d.work_date.split('T')[0] : String(d.work_date);
        return workDate >= currentMonthStr;
      });
      const monthSeconds = monthData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
      const monthHours = Math.round(monthSeconds / 3600 * 10) / 10;

      return {
        userId: user.id,
        displayName: user.display_name || user.email || 'Unknown User',
        todayHours,
        weekHours,
        monthHours
      };
    })
    .sort((a, b) => b.monthHours - a.monthHours); // Sort by monthly hours descending

  return {
    dailySummary: dailySummary || [],
    timeByProject: timeByProject || [],
    orgSummary,
    projectPortfolio,
    userActivity,
    scope: 'GLOBAL',
    organizationId: organization.id,
    organizationName: organization.org_name
  };
}

/**
 * Fetch project analytics data (Project Manager only)
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @param {string} projectKey - Jira Project Key
 * @returns {Promise<Object>} Project analytics data
 */
export async function fetchProjectAnalytics(accountId, cloudId, projectKey) {
  // 1. Check Project Admin Permission
  const permissions = await checkUserPermissions(['ADMINISTER_PROJECTS'], projectKey);
  const hasPermission = permissions.permissions?.ADMINISTER_PROJECTS?.havePermission;

  if (!hasPermission) {
    throw new Error(`Access denied: You are not an administrator for project ${projectKey}`);
  }

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured');
  }

  // Get organization
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  // 2. Fetch Project Data - filter by organization_id
  // Note: project_time_summary uses 'project_key' column (not 'active_project_key')
  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?organization_id=eq.${organization.id}&project_key=eq.${projectKey}&order=total_seconds.desc`
  );

  // Fetch issues for this project
  // Updated to use screenshots.duration_seconds instead of analysis_results.time_spent_seconds
  const timeByIssue = await supabaseRequest(
    supabaseConfig,
    `analysis_results?organization_id=eq.${organization.id}&active_project_key=eq.${projectKey}&work_type=eq.office&select=active_task_key,user_id,screenshots(duration_seconds)&order=created_at.desc&limit=100`
  );

  return {
    timeByProject: timeByProject || [],
    timeByIssue: timeByIssue || [],
    scope: 'PROJECT',
    projectKey,
    organizationId: organization.id
  };
}

/**
 * Fetch team analytics for a specific project (Project Admin only)
 * Returns aggregated team time tracking data WITHOUT individual screenshots
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @param {string} projectKey - Jira Project Key
 * @returns {Promise<Object>} Team analytics data for the project
 */
export async function fetchProjectTeamAnalytics(accountId, cloudId, projectKey) {
  // 1. Check Project Admin Permission
  const permissions = await checkUserPermissions(['ADMINISTER_PROJECTS'], projectKey);
  const hasPermission = permissions.permissions?.ADMINISTER_PROJECTS?.havePermission;

  if (!hasPermission) {
    throw new Error(`Access denied: You are not an administrator for project ${projectKey}`);
  }

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured');
  }

  // Get organization
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  // 2. Fetch Team Data - filter by organization_id
  // Daily summary for the project (uses 'project_key' column, not 'active_project_key')
  const teamDailySummary = await supabaseRequest(
    supabaseConfig,
    `daily_time_summary?organization_id=eq.${organization.id}&project_key=eq.${projectKey}&order=work_date.desc&limit=${MAX_DAILY_SUMMARY_DAYS}`
  );

  // Fetch all users in organization for team member breakdown
  const allUsers = await supabaseRequest(
    supabaseConfig,
    `users?organization_id=eq.${organization.id}&select=id,display_name,email,is_active`
  );

  // Time by issue for this project
  // Updated to use screenshots.duration_seconds instead of analysis_results.time_spent_seconds
  const timeByIssue = await supabaseRequest(
    supabaseConfig,
    `analysis_results?organization_id=eq.${organization.id}&active_project_key=eq.${projectKey}&work_type=eq.office&active_task_key=not.is.null&select=active_task_key,user_id,screenshots(duration_seconds)&order=created_at.desc&limit=200`
  );

  // Aggregate time by issue (across all team members)
  const issueAggregation = {};
  timeByIssue.forEach(result => {
    const key = result.active_task_key;
    if (!issueAggregation[key]) {
      issueAggregation[key] = {
        issueKey: key,
        totalSeconds: 0,
        userCount: new Set()
      };
    }
    // Use screenshots.duration_seconds instead of time_spent_seconds
    issueAggregation[key].totalSeconds += result.screenshots?.duration_seconds || 0;
    if (result.user_id) {
      issueAggregation[key].userCount.add(result.user_id);
    }
  });

  // Convert to array and add user count
  const teamTimeByIssue = Object.values(issueAggregation)
    .map(item => ({
      issueKey: item.issueKey,
      totalSeconds: item.totalSeconds,
      contributors: item.userCount.size
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, MAX_ISSUES_IN_ANALYTICS);

  // === Calculate Team Summary KPIs ===
  const now = new Date();
  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatDate(now);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthStr = formatDate(currentMonthStart);

  // Calculate week start (Monday)
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysToMonday);
  const weekStartStr = formatDate(weekStart);

  // Filter data for this month
  const thisMonthData = (teamDailySummary || []).filter(day => {
    const workDate = typeof day.work_date === 'string' ? day.work_date.split('T')[0] : String(day.work_date);
    return workDate >= currentMonthStr;
  });

  // Total hours this month
  const totalSecondsThisMonth = thisMonthData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
  const totalHoursThisMonth = Math.round(totalSecondsThisMonth / 3600 * 10) / 10;

  // Active members (unique users who tracked time this month)
  const activeMembers = new Set(thisMonthData.map(d => d.user_id)).size;

  // Issues worked (unique issues this month)
  const issuesWorked = new Set(thisMonthData.map(d => d.active_task_key).filter(Boolean)).size;

  // Average hours per member
  const avgHoursPerMember = activeMembers > 0
    ? Math.round(totalHoursThisMonth / activeMembers * 10) / 10
    : 0;

  // Build team summary
  const teamSummary = {
    totalHoursThisMonth,
    activeMembers,
    issuesWorked,
    avgHoursPerMember
  };

  // === Calculate Team Member Activity (Today/Week/Month) ===
  // Get unique user IDs who have worked on this project
  const projectUserIds = new Set(teamDailySummary.map(d => d.user_id));

  const teamMemberActivity = Array.from(projectUserIds).map(userId => {
    // Find user info
    const userInfo = (allUsers || []).find(u => u.id === userId);
    const displayName = userInfo?.display_name || userInfo?.email || 'Unknown User';

    // Filter daily summary for this user
    const userDailyData = (teamDailySummary || []).filter(d => d.user_id === userId);

    // Today's hours
    const todayData = userDailyData.filter(d => {
      const workDate = typeof d.work_date === 'string' ? d.work_date.split('T')[0] : String(d.work_date);
      return workDate === todayStr;
    });
    const todaySeconds = todayData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
    const todayHours = Math.round(todaySeconds / 3600 * 10) / 10;

    // This week's hours
    const weekData = userDailyData.filter(d => {
      const workDate = typeof d.work_date === 'string' ? d.work_date.split('T')[0] : String(d.work_date);
      return workDate >= weekStartStr && workDate <= todayStr;
    });
    const weekSeconds = weekData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
    const weekHours = Math.round(weekSeconds / 3600 * 10) / 10;

    // This month's hours
    const monthData = userDailyData.filter(d => {
      const workDate = typeof d.work_date === 'string' ? d.work_date.split('T')[0] : String(d.work_date);
      return workDate >= currentMonthStr;
    });
    const monthSeconds = monthData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
    const monthHours = Math.round(monthSeconds / 3600 * 10) / 10;

    return {
      userId,
      displayName,
      todayHours,
      weekHours,
      monthHours
    };
  }).sort((a, b) => b.monthHours - a.monthHours);

  // === Calculate Daily Trend (Last 14 days) ===
  const trendDays = 14;
  const trendData = [];
  for (let i = trendDays - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);

    // Sum hours for all users on this date
    const dayData = (teamDailySummary || []).filter(d => {
      const workDate = typeof d.work_date === 'string' ? d.work_date.split('T')[0] : String(d.work_date);
      return workDate === dateStr;
    });
    const totalSeconds = dayData.reduce((sum, d) => sum + (d.total_seconds || 0), 0);
    const totalHours = Math.round(totalSeconds / 3600 * 10) / 10;

    trendData.push({
      date: dateStr,
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      totalHours
    });
  }

  return {
    teamSummary,
    teamMemberActivity,
    teamDailySummary: teamDailySummary || [],
    teamTimeByIssue,
    activityTrend: trendData,
    scope: 'TEAM',
    projectKey,
    organizationId: organization.id
  };
}
