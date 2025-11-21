/**
 * Analytics Service
 * Business logic for time tracking analytics
 */

import { getSupabaseConfig, getOrCreateUser, supabaseRequest } from '../utils/supabase.js';
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
