/**
 * Analytics Service
 * Business logic for time tracking analytics
 */

import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, getUserOrganizationMembership, supabaseRequest } from '../utils/supabase.js';
import { isJiraAdmin, checkUserPermissions } from '../utils/jira.js';
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
  // Daily Summary (All Users in this organization)
  const dailySummary = await supabaseRequest(
    supabaseConfig,
    `daily_time_summary?organization_id=eq.${organization.id}&order=work_date.desc&limit=${MAX_DAILY_SUMMARY_DAYS}`
  );

  // Project Summary (All Projects in this organization)
  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?organization_id=eq.${organization.id}&order=total_seconds.desc`
  );

  return {
    dailySummary: dailySummary || [],
    timeByProject: timeByProject || [],
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

  return {
    teamDailySummary: teamDailySummary || [],
    teamTimeByIssue,
    scope: 'TEAM',
    projectKey,
    organizationId: organization.id
  };
}
