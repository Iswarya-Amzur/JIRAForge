/**
 * Session Resolvers for Unassigned Work
 * Handles fetching and querying unassigned work sessions and groups
 */

import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest, generateSignedUrl } from '../../utils/supabase.js';
import { formatDuration } from '../../utils/formatters.js';

/**
 * Get unassigned work sessions for current user
 */
export async function getUnassignedWork(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { limit, offset, dateFrom, dateTo } = req.payload || {};

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get or create organization first (multi-tenancy)
    const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
    if (!organization) {
      return { success: false, error: 'Unable to get organization information' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

    // Build query string - filter by organization_id for multi-tenancy
    let query = `analysis_results?select=*,screenshots(id,window_title,application_name,timestamp,thumbnail_url,storage_path)&user_id=eq.${userId}&organization_id=eq.${organization.id}&active_task_key=is.null&order=created_at.desc`;

    if (limit) query += `&limit=${limit}`;
    if (offset) query += `&offset=${offset}`;
    if (dateFrom) query += `&created_at=gte.${dateFrom}`;
    if (dateTo) query += `&created_at=lte.${dateTo}`;

    const results = await supabaseRequest(supabaseConfig, query);

    // Flatten data structure
    const sessions = (results || []).map(result => ({
      ...result,
      screenshot_id: result.screenshots?.id || result.screenshot_id,
      window_title: result.screenshots?.window_title,
      application_name: result.screenshots?.application_name,
      timestamp: result.screenshots?.timestamp || result.created_at,
      thumbnail_url: result.screenshots?.thumbnail_url,
      storage_path: result.screenshots?.storage_path
    }));

    return {
      success: true,
      sessions,
      total: sessions.length
    };

  } catch (error) {
    console.error('Error getting unassigned work:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get already-clustered groups from database (AI server creates these automatically)
 * LAZY LOADING: Returns summary data only (no session_ids), with pagination
 * Full details are loaded on-demand via getGroupDetails when user expands a group
 */
export async function getUnassignedGroups(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { limit = 10, offset = 0 } = req.payload || {};

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get or create organization first (multi-tenancy) - these are cached
    const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
    if (!organization) {
      return { success: false, error: 'Unable to get organization information' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

    // First, get total count for pagination info
    const countResult = await supabaseRequest(
      supabaseConfig,
      `unassigned_work_groups?user_id=eq.${userId}&organization_id=eq.${organization.id}&is_assigned=eq.false&select=id`,
      { headers: { 'Prefer': 'count=exact' } }
    );
    const totalCount = Array.isArray(countResult) ? countResult.length : 0;

    // LAZY LOADING: Fetch only summary data (no members/activities) with pagination
    // Session details loaded on-demand via getGroupDetails
    const groups = await supabaseRequest(
      supabaseConfig,
      `unassigned_work_groups?user_id=eq.${userId}&organization_id=eq.${organization.id}&is_assigned=eq.false&order=created_at.desc&limit=${limit}&offset=${offset}&select=id,group_label,group_description,session_count,total_seconds,confidence_level,recommended_action,suggested_issue_key,recommendation_reason,created_at`
    );

    if (!groups || groups.length === 0) {
      return { success: true, groups: [], total_groups: totalCount, has_more: false };
    }

    console.log(`[getUnassignedGroups] Loaded ${groups.length} groups (offset: ${offset}, total: ${totalCount})`);

    // Transform groups with minimal processing (no additional API calls)
    const enrichedGroups = groups.map((group) => {
      // Use DB values directly - no recalculation needed for summary view
      const totalTimeFormatted = formatDuration(group.total_seconds || 0);

      // Format recommendation data
      const recommendation = group.recommended_action ? {
        action: group.recommended_action,
        suggested_issue_key: group.suggested_issue_key || null,
        reason: group.recommendation_reason || ''
      } : null;

      return {
        id: group.id,
        label: group.group_label,
        description: group.group_description,
        session_count: group.session_count || 0,
        total_seconds: group.total_seconds || 0,
        total_time_formatted: totalTimeFormatted,
        confidence: group.confidence_level || 'medium',
        recommendation: recommendation,
        created_at: group.created_at,
        // Note: session_ids NOT included - loaded on-demand via getGroupDetails
        // This flag indicates details need to be fetched when expanded
        details_loaded: false
      };
    });

    // Filter out groups with 0 sessions (data inconsistency)
    const validGroups = enrichedGroups.filter(g => g.session_count > 0);

    return {
      success: true,
      groups: validGroups,
      total_groups: totalCount,
      has_more: offset + limit < totalCount,
      next_offset: offset + limit
    };

  } catch (error) {
    console.error('Error getting unassigned groups:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get detailed data for a specific group (session_ids, recalculated totals)
 * LAZY LOADING: Called when user expands a group to see details
 */
export async function getGroupDetails(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { groupId } = req.payload;

    if (!groupId) {
      return { success: false, error: 'Group ID required' };
    }

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get or create organization first (multi-tenancy) - cached
    const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
    if (!organization) {
      return { success: false, error: 'Unable to get organization information' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

    console.log(`[getGroupDetails] Loading details for group: ${groupId}`);

    // Fetch group members with activity data in a single query
    const members = await supabaseRequest(
      supabaseConfig,
      `unassigned_group_members?group_id=eq.${groupId}&select=id,unassigned_activity_id,unassigned_activity(id,time_spent_seconds,window_title,application_name,timestamp)`
    );

    const membersArray = Array.isArray(members) ? members : (members ? [members] : []);

    // Calculate accurate total_seconds from actual activities
    let totalSeconds = 0;
    membersArray.forEach(member => {
      if (member?.unassigned_activity?.time_spent_seconds) {
        totalSeconds += member.unassigned_activity.time_spent_seconds;
      }
    });

    // Extract valid session IDs
    const sessionIds = membersArray
      .map(m => m?.unassigned_activity_id)
      .filter(id => {
        if (!id || typeof id !== 'string' || id.trim() === '') return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
      });

    console.log(`[getGroupDetails] Group ${groupId}: ${sessionIds.length} sessions, ${totalSeconds}s total`);

    return {
      success: true,
      groupId,
      session_ids: sessionIds,
      session_count: sessionIds.length,
      total_seconds: totalSeconds,
      total_time_formatted: formatDuration(totalSeconds),
      has_valid_sessions: sessionIds.length > 0
    };

  } catch (error) {
    console.error('Error getting group details:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get screenshots for unassigned work group
 */
export async function getGroupScreenshots(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { sessionIds } = req.payload;

    console.log(`[getGroupScreenshots] Received ${sessionIds?.length || 0} session IDs`);

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return { success: false, error: 'No session IDs provided' };
    }

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get or create organization first (multi-tenancy)
    const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
    if (!organization) {
      return { success: false, error: 'Unable to get organization information' };
    }

    const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

    // Get unassigned_activity records with their screenshot information
    const sessionIdsParam = sessionIds.join(',');
    console.log(`[getGroupScreenshots] Querying unassigned_activity with ${sessionIds.length} IDs`);
    const activities = await supabaseRequest(
      supabaseConfig,
      `unassigned_activity?id=in.(${sessionIdsParam})&user_id=eq.${userId}&select=id,analysis_result_id,window_title,application_name,time_spent_seconds,timestamp`
    );

    console.log(`[getGroupScreenshots] Found ${activities?.length || 0} unassigned_activity records`);

    if (!activities || activities.length === 0) {
      console.log('[getGroupScreenshots] No activities found');
      return { success: true, screenshots: [] };
    }

    // Get analysis_result_ids to fetch screenshot details
    const activitiesArray = Array.isArray(activities) ? activities : [activities];
    const analysisResultIds = activitiesArray.map(a => a.analysis_result_id).filter(Boolean);

    console.log(`[getGroupScreenshots] Found ${analysisResultIds.length} analysis_result_ids`);

    if (analysisResultIds.length === 0) {
      console.log('[getGroupScreenshots] No analysis result IDs found');
      return { success: true, screenshots: [] };
    }

    // Fetch analysis_results with screenshot data
    const analysisIdsParam = analysisResultIds.join(',');
    console.log(`[getGroupScreenshots] Querying analysis_results with ${analysisResultIds.length} IDs`);
    const analysisResults = await supabaseRequest(
      supabaseConfig,
      `analysis_results?id=in.(${analysisIdsParam})&select=id,screenshot_id,screenshots(id,timestamp,storage_path,thumbnail_url,window_title,application_name)`
    );

    const resultsArray = Array.isArray(analysisResults) ? analysisResults : (analysisResults ? [analysisResults] : []);
    console.log(`[getGroupScreenshots] Found ${resultsArray.length} analysis_results with screenshots`);

    // Generate signed URLs for screenshots in batches to avoid rate limiting
    const BATCH_SIZE = 10; // Process 10 at a time to avoid rate limits
    const screenshotsWithUrls = [];

    for (let i = 0; i < resultsArray.length; i += BATCH_SIZE) {
      const batch = resultsArray.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (result) => {
          const screenshot = result.screenshots;
          if (!screenshot) return null;

          // Generate signed URL for thumbnail
          let signed_thumbnail_url = screenshot.thumbnail_url;
          if (screenshot.storage_path) {
            try {
              let thumbPath;
              if (screenshot.storage_path.includes('/')) {
                const dirPath = screenshot.storage_path.substring(0, screenshot.storage_path.lastIndexOf('/'));
                const filename = screenshot.storage_path.substring(screenshot.storage_path.lastIndexOf('/') + 1);
                const thumbFilename = filename.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
                thumbPath = `${dirPath}/${thumbFilename}`;
              } else {
                thumbPath = screenshot.storage_path.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
              }

              signed_thumbnail_url = await generateSignedUrl(supabaseConfig, 'screenshots', thumbPath, 3600);
            } catch (err) {
              console.error('Error generating signed URL:', err);
            }
          }

          return {
            id: screenshot.id,
            timestamp: screenshot.timestamp,
            window_title: screenshot.window_title,
            application_name: screenshot.application_name,
            signed_thumbnail_url
          };
        })
      );
      screenshotsWithUrls.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < resultsArray.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const validScreenshots = screenshotsWithUrls.filter(Boolean);

    return {
      success: true,
      screenshots: validScreenshots
    };

  } catch (error) {
    console.error('Error getting group screenshots:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Register session resolvers
 */
export function registerSessionResolvers(resolver) {
  resolver.define('getUnassignedWork', getUnassignedWork);
  resolver.define('getUnassignedGroups', getUnassignedGroups);
  resolver.define('getGroupDetails', getGroupDetails);
  resolver.define('getGroupScreenshots', getGroupScreenshots);
}
