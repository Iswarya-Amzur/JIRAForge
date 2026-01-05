/**
 * Team Analytics Service
 * Handles project-level and team analytics
 */

import { getSupabaseConfig, getOrCreateOrganization, supabaseRequest } from '../../utils/supabase.js';
import { checkUserPermissions } from '../../utils/jira.js';
import { MAX_DAILY_SUMMARY_DAYS, MAX_ISSUES_IN_ANALYTICS } from '../../config/constants.js';

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
  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?organization_id=eq.${organization.id}&project_key=eq.${projectKey}&order=total_seconds.desc`
  );

  // Fetch issues for this project
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
  const teamDailySummary = await supabaseRequest(
    supabaseConfig,
    `daily_time_summary?organization_id=eq.${organization.id}&project_key=eq.${projectKey}&order=work_date.desc&limit=${MAX_DAILY_SUMMARY_DAYS}`
  );

  const allUsers = await supabaseRequest(
    supabaseConfig,
    `users?organization_id=eq.${organization.id}&select=id,display_name,email,is_active`
  );

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
    issueAggregation[key].totalSeconds += result.screenshots?.duration_seconds || 0;
    if (result.user_id) {
      issueAggregation[key].userCount.add(result.user_id);
    }
  });

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
  // Note: column is now 'task_key' in the view (was 'active_task_key')
  const issuesWorked = new Set(thisMonthData.map(d => d.task_key || d.active_task_key).filter(Boolean)).size;

  // Average hours per member
  const avgHoursPerMember = activeMembers > 0
    ? Math.round(totalHoursThisMonth / activeMembers * 10) / 10
    : 0;

  const teamSummary = {
    totalHoursThisMonth,
    activeMembers,
    issuesWorked,
    avgHoursPerMember
  };

  // === Calculate Team Member Activity (Today/Week/Month) ===
  const projectUserIds = new Set(teamDailySummary.map(d => d.user_id));

  const teamMemberActivity = Array.from(projectUserIds).map(userId => {
    const userInfo = (allUsers || []).find(u => u.id === userId);
    const displayName = userInfo?.display_name || userInfo?.email || 'Unknown User';

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
