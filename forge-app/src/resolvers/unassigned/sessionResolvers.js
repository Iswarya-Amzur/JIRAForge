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
    // IMPORTANT: Use screenshots.duration_seconds (source of truth) instead of unassigned_activity.time_spent_seconds (stale)
    const members = await supabaseRequest(
      supabaseConfig,
      `unassigned_group_members?group_id=eq.${groupId}&select=id,unassigned_activity_id,unassigned_activity(id,window_title,application_name,timestamp,screenshot_id,screenshots(duration_seconds))`
    );

    const membersArray = Array.isArray(members) ? members : (members ? [members] : []);

    // Calculate accurate total_seconds from screenshots.duration_seconds (source of truth)
    let totalSeconds = 0;
    membersArray.forEach(member => {
      const durationSeconds = member?.unassigned_activity?.screenshots?.duration_seconds;
      if (durationSeconds) {
        totalSeconds += durationSeconds;
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
    // IMPORTANT: Use screenshots.duration_seconds (source of truth) instead of time_spent_seconds (stale)
    const sessionIdsParam = sessionIds.join(',');
    console.log(`[getGroupScreenshots] Querying unassigned_activity with ${sessionIds.length} IDs`);
    const activities = await supabaseRequest(
      supabaseConfig,
      `unassigned_activity?id=in.(${sessionIdsParam})&user_id=eq.${userId}&select=id,analysis_result_id,window_title,application_name,timestamp,screenshot_id,screenshots(duration_seconds)`
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
    // Include duration_seconds from screenshots (source of truth)
    const analysisIdsParam = analysisResultIds.join(',');
    console.log(`[getGroupScreenshots] Querying analysis_results with ${analysisResultIds.length} IDs`);
    const analysisResults = await supabaseRequest(
      supabaseConfig,
      `analysis_results?id=in.(${analysisIdsParam})&select=id,screenshot_id,screenshots(id,timestamp,storage_path,thumbnail_url,window_title,application_name,duration_seconds)`
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
          let signed_url = null;

          if (screenshot.storage_path) {
            try {
              // Generate signed URL for full-size image
              signed_url = await generateSignedUrl(supabaseConfig, 'screenshots', screenshot.storage_path, 3600);

              // Generate signed URL for thumbnail
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
            signed_thumbnail_url,
            signed_url
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

    // Sort screenshots by timestamp in descending order (latest first)
    validScreenshots.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
      return dateB - dateA;
    });

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
 * Get work sessions for unassigned work group (grouped by date like Dashboard)
 */
export async function getGroupWorkSessions(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { sessionIds } = req.payload;

    console.log(`[getGroupWorkSessions] Received ${sessionIds?.length || 0} session IDs`);

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

    // Get unassigned_activity records with screenshot timing data
    const sessionIdsParam = sessionIds.join(',');
    const activities = await supabaseRequest(
      supabaseConfig,
      `unassigned_activity?id=in.(${sessionIdsParam})&user_id=eq.${userId}&select=id,analysis_result_id,window_title,application_name,timestamp,screenshot_id,screenshots(id,timestamp,start_time,end_time,duration_seconds,storage_path)&order=timestamp.asc`
    );

    if (!activities || activities.length === 0) {
      return { success: true, workSessions: [], sessionsByDate: {} };
    }

    const activitiesArray = Array.isArray(activities) ? activities : [activities];

    // Build work sessions similar to Dashboard logic
    const workSessions = [];
    const SESSION_GAP_THRESHOLD = 10 * 60 * 1000; // 10 minutes in milliseconds

    // Sort by timestamp
    const sortedActivities = [...activitiesArray].sort((a, b) => {
      const timeA = a.screenshots?.timestamp || a.timestamp;
      const timeB = b.screenshots?.timestamp || b.timestamp;
      return new Date(timeA) - new Date(timeB);
    });

    for (const activity of sortedActivities) {
      const screenshot = activity.screenshots;
      if (!screenshot) continue;

      const screenshotTimestamp = screenshot.timestamp || activity.timestamp;
      const durationSeconds = screenshot.duration_seconds || 0;

      // Calculate start and end time
      const endTime = new Date(screenshotTimestamp);
      const startTime = screenshot.start_time
        ? new Date(screenshot.start_time)
        : new Date(endTime.getTime() - (durationSeconds * 1000));

      // Check if this can be merged with the last session
      if (workSessions.length > 0) {
        const lastSession = workSessions[workSessions.length - 1];
        const timeSinceLastSession = startTime - new Date(lastSession.endTime);

        if (timeSinceLastSession <= SESSION_GAP_THRESHOLD) {
          // Extend existing session - update end time and accumulate actual duration
          lastSession.endTime = endTime.toISOString();
          lastSession.activityIds.push(activity.id);
          lastSession.screenshotIds.push(screenshot.id);
          // Track actual duration (sum of screenshot durations, not time span)
          lastSession.durationSeconds = (lastSession.durationSeconds || 0) + durationSeconds;
          continue;
        }
      }

      // Create new session with actual duration tracking
      workSessions.push({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        date: startTime.toISOString().split('T')[0],
        activityIds: [activity.id],
        screenshotIds: [screenshot.id],
        // Track actual duration from screenshot (not time span)
        durationSeconds: durationSeconds
      });
    }

    // Group sessions by date
    const sessionsByDate = {};
    workSessions.forEach(session => {
      const dateKey = session.date;
      if (!sessionsByDate[dateKey]) {
        sessionsByDate[dateKey] = [];
      }
      sessionsByDate[dateKey].push(session);
    });

    // Calculate totals for each date using actual duration (not time span)
    const dateGroups = Object.keys(sessionsByDate)
      .sort((a, b) => new Date(b) - new Date(a)) // Most recent first
      .map(dateKey => {
        const sessions = sessionsByDate[dateKey];
        // Use actual tracked durationSeconds (sum of screenshot durations)
        const totalSeconds = sessions.reduce((sum, s) => {
          return sum + (s.durationSeconds || 0);
        }, 0);

        return {
          date: dateKey,
          sessions: sessions,
          totalSeconds: totalSeconds,
          totalFormatted: formatDuration(totalSeconds)
        };
      });

    return {
      success: true,
      workSessions: workSessions,
      dateGroups: dateGroups
    };

  } catch (error) {
    console.error('Error getting group work sessions:', error);
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
  resolver.define('getGroupWorkSessions', getGroupWorkSessions);
}
