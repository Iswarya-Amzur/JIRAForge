/**
 * Diagnostic Resolvers
 * Resolver definitions for debugging and diagnosing data issues
 */

import { getSupabaseConfig, getOrCreateUser, supabaseRequest } from '../utils/supabase.js';

/**
 * Register diagnostic resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerDiagnosticResolvers(resolver) {
  /**
   * Resolver for checking raw screenshot data for a specific date
   * Helps diagnose timestamp issues
   */
  resolver.define('getDiagnosticDataForDate', async (req) => {
    const { payload, context } = req;
    const { targetDate } = payload; // Expected format: 'YYYY-MM-DD'
    const accountId = context.accountId;

    try {
      const supabaseConfig = await getSupabaseConfig(accountId);
      if (!supabaseConfig) {
        return {
          success: false,
          error: 'Supabase not configured'
        };
      }

      const userId = await getOrCreateUser(accountId, supabaseConfig);
      if (!userId) {
        return {
          success: false,
          error: 'Unable to get user information'
        };
      }

      // Get all screenshots for the target date (checking both user-specific and all users)
      // Use PostgreSQL date conversion to match the view logic
      const allScreenshots = await supabaseRequest(
        supabaseConfig,
        `screenshots?select=id,timestamp,window_title,application_name,status,analysis_results(id,time_spent_seconds,active_task_key,work_type,created_at)&order=timestamp.asc&limit=1000`
      );

      // Filter screenshots that match the target date when converted to UTC
      const targetDateScreenshots = allScreenshots.filter(screenshot => {
        const screenshotDate = new Date(screenshot.timestamp);
        const utcDate = screenshotDate.toISOString().split('T')[0];
        return utcDate === targetDate;
      });

      // Get daily_time_summary data for comparison
      const dailySummaryQuery = `daily_time_summary?work_date=eq.${targetDate}`;
      const dailySummary = await supabaseRequest(supabaseConfig, dailySummaryQuery);

      // Get user info for context
      const userInfo = await supabaseRequest(
        supabaseConfig,
        `users?id=eq.${userId}&select=display_name,email,atlassian_account_id`
      );

      return {
        success: true,
        data: {
          targetDate,
          currentUser: userInfo[0] || {},
          screenshotCount: targetDateScreenshots.length,
          screenshots: targetDateScreenshots.map(s => ({
            id: s.id,
            timestamp: s.timestamp,
            timestampUTC: new Date(s.timestamp).toISOString(),
            windowTitle: s.window_title,
            applicationName: s.application_name,
            status: s.status,
            analysisResults: s.analysis_results?.map(ar => ({
              id: ar.id,
              timeSpent: ar.time_spent_seconds,
              taskKey: ar.active_task_key,
              workType: ar.work_type,
              createdAt: ar.created_at,
              createdAtUTC: new Date(ar.created_at).toISOString()
            })) || []
          })),
          dailySummary: dailySummary || [],
          totalTimeSeconds: dailySummary?.reduce((sum, item) => sum + (item.total_seconds || 0), 0) || 0
        }
      };
    } catch (error) {
      console.error('Error in diagnostic query:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}
