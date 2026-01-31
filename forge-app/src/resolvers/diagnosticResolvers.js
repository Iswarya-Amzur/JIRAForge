/**
 * Diagnostic Resolvers
 * Resolver definitions for debugging and diagnosing data issues
 */

import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest } from '../utils/supabase.js';
import { isValidDate } from '../utils/validators.js';

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
    const cloudId = context.cloudId;  // Multi-tenancy: Get Jira Cloud ID from context

    // Validate date format
    if (!targetDate || !isValidDate(targetDate)) {
      return {
        success: false,
        error: 'Valid target date required (YYYY-MM-DD format)'
      };
    }

    try {
      const supabaseConfig = await getSupabaseConfig(accountId);
      if (!supabaseConfig) {
        return {
          success: false,
          error: 'Supabase not configured'
        };
      }

      // Get or create organization first (multi-tenancy)
      const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
      if (!organization) {
        return {
          success: false,
          error: 'Unable to get organization information'
        };
      }

      const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
      if (!userId) {
        return {
          success: false,
          error: 'Unable to get user information'
        };
      }

      // Get all screenshots for the target date - filter by organization_id for multi-tenancy
      // Use PostgreSQL date conversion to match the view logic
      // Updated to use screenshots.duration_seconds instead of analysis_results.time_spent_seconds
      const allScreenshots = await supabaseRequest(
        supabaseConfig,
        `screenshots?organization_id=eq.${organization.id}&select=id,timestamp,duration_seconds,window_title,application_name,status,analysis_results(id,active_task_key,work_type,created_at)&order=timestamp.asc&limit=1000`
      );

      // Filter screenshots that match the target date when converted to UTC
      const targetDateScreenshots = allScreenshots.filter(screenshot => {
        const screenshotDate = new Date(screenshot.timestamp);
        const utcDate = screenshotDate.toISOString().split('T')[0];
        return utcDate === targetDate;
      });

      // Get daily_time_summary data for comparison - filter by organization_id
      const dailySummaryQuery = `daily_time_summary?work_date=eq.${targetDate}&organization_id=eq.${organization.id}`;
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
              timeSpent: s.duration_seconds,  // Use from screenshot, not analysis_result
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
