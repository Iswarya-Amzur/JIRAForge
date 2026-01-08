/**
 * Organization Analytics Service
 * Handles organization-wide analytics (Admin only)
 */

import { getSupabaseConfig, getOrCreateOrganization, supabaseRequest } from '../../utils/supabase.js';
import { isJiraAdmin, getAllJiraProjectKeys } from '../../utils/jira.js';

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
  const dailySummary = await supabaseRequest(
    supabaseConfig,
    `daily_time_summary?organization_id=eq.${organization.id}&order=work_date.desc&limit=60`
  );

  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?organization_id=eq.${organization.id}&order=total_seconds.desc`
  );

  const allUsers = await supabaseRequest(
    supabaseConfig,
    `users?organization_id=eq.${organization.id}&select=id,display_name,email,is_active`
  );

  // Calculate date ranges
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

  // Calculate date thresholds for activity status
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = formatDate(sevenDaysAgo);
  
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);

  // Build project portfolio with contributor counts and activity-based status
  const projectPortfolio = (timeByProject || [])
    .filter(project => {
      const isValid = validJiraProjectKeys.has(project.project_key);
      if (!isValid) {
        console.log(`[Analytics] Filtering out invalid project: ${project.project_key}`);
      }
      return isValid;
    })
    .map(project => {
      const projectAllTime = (dailySummary || []).filter(d => d.project_key === project.project_key);

      // Find last active date
      const lastActivityRecord = projectAllTime.length > 0 ? projectAllTime[0] : null;
      const lastActiveDate = lastActivityRecord 
        ? new Date(typeof lastActivityRecord.work_date === 'string' 
            ? lastActivityRecord.work_date.split('T')[0] 
            : String(lastActivityRecord.work_date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

      // Determine activity status based on recent activity
      let activityStatus = 'inactive';
      if (lastActivityRecord) {
        const lastDate = typeof lastActivityRecord.work_date === 'string' 
          ? lastActivityRecord.work_date.split('T')[0] 
          : String(lastActivityRecord.work_date);
        
        if (lastDate >= sevenDaysAgoStr) {
          activityStatus = 'active';
        } else if (lastDate >= thirtyDaysAgoStr) {
          activityStatus = 'moderate';
        }
      }

      // All-time totals from project_time_summary view
      const totalHours = Math.round((project.total_seconds || 0) / 3600 * 10) / 10;
      const contributorCount = project.unique_users || 0;
      
      // All-time issue count from all daily summaries
      const issueCount = new Set(projectAllTime.map(d => d.task_key || d.active_task_key).filter(Boolean)).size;

      return {
        projectKey: project.project_key,
        totalHours,
        totalSeconds: project.total_seconds || 0,
        contributorCount,
        issueCount,
        lastActiveDate,
        activityStatus
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
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysToMonday);
  const weekStartStr = formatDate(weekStart);

  // Build user activity data
  const userActivity = (allUsers || [])
    .filter(user => user.is_active !== false)
    .map(user => {
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
    .sort((a, b) => b.monthHours - a.monthHours);

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
