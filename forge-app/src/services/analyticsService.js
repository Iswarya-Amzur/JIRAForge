/**
 * Analytics Service
 * Business logic for time tracking analytics
 */

import { getSupabaseConfig, getOrCreateUser, supabaseRequest } from '../utils/supabase.js';
import { isJiraAdmin, checkUserPermissions } from '../utils/jira.js';
import { MAX_DAILY_SUMMARY_DAYS, MAX_WEEKLY_SUMMARY_WEEKS, MAX_ISSUES_IN_ANALYTICS } from '../config/constants.js';

/**
 * Fetch time analytics data for a user
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} Analytics data (daily, weekly, by project, by issue)
 */
export async function fetchTimeAnalytics(accountId) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  const userId = await getOrCreateUser(accountId, supabaseConfig);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Fetch daily summary
  const dailySummary = await supabaseRequest(
    supabaseConfig,
    `daily_time_summary?user_id=eq.${userId}&order=work_date.desc&limit=${MAX_DAILY_SUMMARY_DAYS}`
  );

  // Fetch weekly summary
  const weeklySummary = await supabaseRequest(
    supabaseConfig,
    `weekly_time_summary?user_id=eq.${userId}&order=week_start.desc&limit=${MAX_WEEKLY_SUMMARY_WEEKS}`
  );

  // Fetch project time summary
  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?user_id=eq.${userId}&order=total_seconds.desc`
  );

  // Fetch time by issue (from analysis_results)
  const timeByIssue = await supabaseRequest(
    supabaseConfig,
    `analysis_results?user_id=eq.${userId}&is_active_work=eq.true&is_idle=eq.false&active_task_key=not.is.null&select=active_task_key,active_project_key,time_spent_seconds&order=created_at.desc`
  );

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
    issueAggregation[key].totalSeconds += result.time_spent_seconds || 0;
  });

  const timeByIssueArray = Object.values(issueAggregation)
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, MAX_ISSUES_IN_ANALYTICS);

  return {
    dailySummary: dailySummary || [],
    weeklySummary: weeklySummary || [],
    timeByProject: timeByProject || [],
    timeByIssue: timeByIssueArray
  };
}
/**
 * Fetch all analytics data (Admin only)
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} All analytics data
 */
export async function fetchAllAnalytics(accountId) {
  // 1. Check Admin Permission
  const isAdmin = await isJiraAdmin();
  if (!isAdmin) {
    throw new Error('Access denied: Requires Jira Administrator permission');
  }

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured');
  }

  // 2. Fetch All Data (No user_id filter)
  // Note: For large datasets, we should implement pagination. 
  // For now, we fetch top records to demonstrate capability.

  // Daily Summary (All Users)
  const dailySummary = await supabaseRequest(
    supabaseConfig,
    `daily_time_summary?order=work_date.desc&limit=${MAX_DAILY_SUMMARY_DAYS}`
  );

  // Project Summary (All Projects)
  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?order=total_seconds.desc`
  );

  return {
    dailySummary: dailySummary || [],
    timeByProject: timeByProject || [],
    scope: 'GLOBAL'
  };
}

/**
 * Fetch project analytics data (Project Manager only)
 * @param {string} accountId - Atlassian account ID
 * @param {string} projectKey - Jira Project Key
 * @returns {Promise<Object>} Project analytics data
 */
export async function fetchProjectAnalytics(accountId, projectKey) {
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

  // 2. Fetch Project Data
  const timeByProject = await supabaseRequest(
    supabaseConfig,
    `project_time_summary?active_project_key=eq.${projectKey}&order=total_seconds.desc`
  );

  // Fetch issues for this project
  const timeByIssue = await supabaseRequest(
    supabaseConfig,
    `analysis_results?active_project_key=eq.${projectKey}&is_active_work=eq.true&select=active_task_key,time_spent_seconds,user_id&order=created_at.desc&limit=100`
  );

  return {
    timeByProject: timeByProject || [],
    timeByIssue: timeByIssue || [],
    scope: 'PROJECT',
    projectKey
  };
}

/**
 * Fetch team analytics for a specific project (Project Admin only)
 * Returns aggregated team time tracking data WITHOUT individual screenshots
 * @param {string} accountId - Atlassian account ID
 * @param {string} projectKey - Jira Project Key
 * @returns {Promise<Object>} Team analytics data for the project
 */
export async function fetchProjectTeamAnalytics(accountId, projectKey) {
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

  // 2. Fetch Team Data (all users for this project)
  // Daily summary for the project
  const teamDailySummary = await supabaseRequest(
    supabaseConfig,
    `daily_time_summary?active_project_key=eq.${projectKey}&order=work_date.desc&limit=${MAX_DAILY_SUMMARY_DAYS}`
  );

  // Time by issue for this project
  const timeByIssue = await supabaseRequest(
    supabaseConfig,
    `analysis_results?active_project_key=eq.${projectKey}&is_active_work=eq.true&is_idle=eq.false&active_task_key=not.is.null&select=active_task_key,time_spent_seconds,user_id&order=created_at.desc&limit=200`
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
    issueAggregation[key].totalSeconds += result.time_spent_seconds || 0;
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
    projectKey
  };
}
