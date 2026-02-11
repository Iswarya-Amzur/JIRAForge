/**
 * Scheduled Worklog Sync
 * Runs on a Forge scheduled trigger to sync all users' tracked time to Jira worklogs.
 *
 * Uses api.asApp() since scheduled triggers have no user context.
 * Worklogs will appear as created by the app, not individual users.
 */

import { createJiraWorklogAsApp, updateJiraWorklogAsApp, deleteJiraWorklogAsApp } from '../utils/jira.js';
import { getSupabaseConfig, supabaseRequest } from '../utils/supabase.js';
import { formatJiraDate } from '../utils/formatters.js';

const SYNC_BATCH_LIMIT = 10; // Max issues per user per run
const MIN_SYNC_SECONDS = 60;

/**
 * Format a DB timestamp for Jira's worklog `started` field.
 * Timestamps are stored as proper UTC, so we parse and format via formatJiraDate.
 */
function formatStartedForJira(timestamp) {
  if (!timestamp) return formatJiraDate();
  return formatJiraDate(new Date(timestamp));
}

/**
 * Main entry point for the scheduled trigger.
 * Iterates over all organizations and users, syncing worklogs for each.
 */
export async function runScheduledWorklogSync() {
  console.log('[ScheduledSync] Starting scheduled worklog sync');

  try {
    const supabaseConfig = await getSupabaseConfig();

    // Check if any organization has sync enabled
    const orgsWithSync = await supabaseRequest(
      supabaseConfig,
      'tracking_settings?jira_worklog_sync_enabled=eq.true&select=organization_id'
    );

    if (!orgsWithSync || orgsWithSync.length === 0) {
      console.log('[ScheduledSync] No organizations have worklog sync enabled, skipping');
      return { success: true, message: 'Sync not enabled for any organization' };
    }

    const enabledOrgIds = orgsWithSync.map(o => o.organization_id).filter(Boolean);
    console.log(`[ScheduledSync] Found ${enabledOrgIds.length} organizations with sync enabled`);

    let totalSynced = 0;
    let totalErrors = 0;

    for (const orgId of enabledOrgIds) {
      try {
        const result = await syncOrganization(supabaseConfig, orgId);
        totalSynced += result.synced;
        totalErrors += result.errors;
      } catch (orgError) {
        console.error(`[ScheduledSync] Failed to sync org ${orgId}:`, orgError.message);
        totalErrors++;
      }
    }

    console.log(`[ScheduledSync] Completed. Synced: ${totalSynced}, Errors: ${totalErrors}`);
    return { success: true, synced: totalSynced, errors: totalErrors };
  } catch (error) {
    console.error('[ScheduledSync] Fatal error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sync all users' worklogs for a single organization.
 */
async function syncOrganization(supabaseConfig, organizationId) {
  // Fetch ALL analysis_results for this org using pagination (no date filter — match dashboard totals)
  const PAGE_SIZE = 1000;
  const timeByUserIssue = {};
  const lastWorkedByUserIssue = {};
  let offset = 0;
  let totalFetched = 0;

  while (true) {
    const page = await supabaseRequest(
      supabaseConfig,
      `analysis_results?organization_id=eq.${organizationId}&work_type=eq.office&active_task_key=not.is.null&select=user_id,active_task_key,screenshots(duration_seconds,timestamp)&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`
    );

    if (!page || !Array.isArray(page) || page.length === 0) {
      break;
    }

    page.forEach(entry => {
      const key = `${entry.user_id}::${entry.active_task_key}`;
      if (!timeByUserIssue[key]) {
        timeByUserIssue[key] = 0;
        lastWorkedByUserIssue[key] = null;
      }
      timeByUserIssue[key] += entry.screenshots?.duration_seconds || 0;
      const ts = entry.screenshots?.timestamp;
      if (ts && (!lastWorkedByUserIssue[key] || ts > lastWorkedByUserIssue[key])) {
        lastWorkedByUserIssue[key] = ts;
      }
    });

    totalFetched += page.length;
    offset += page.length;

    // Stop if we got fewer results than page size (last page)
    if (page.length < PAGE_SIZE) {
      break;
    }

    // Safety limit to prevent infinite loops
    if (totalFetched > 50000) {
      console.warn(`[ScheduledSync] Safety limit reached (50000 records) for org ${organizationId}`);
      break;
    }
  }

  if (totalFetched === 0) {
    console.log(`[ScheduledSync] No time data for org ${organizationId}`);
  } else {
    console.log(`[ScheduledSync] Fetched ${totalFetched} records for org ${organizationId}`);
  }

  // Build list of {userId, issueKey, timeTracked, lastWorkedOn}
  const entries = Object.entries(timeByUserIssue)
    .filter(([, seconds]) => seconds >= MIN_SYNC_SECONDS)
    .map(([key, seconds]) => {
      const [userId, issueKey] = key.split('::');
      return {
        userId,
        issueKey,
        timeTracked: Math.round(seconds),
        lastWorkedOn: lastWorkedByUserIssue[key]
      };
    });

  let synced = 0;
  let errors = 0;

  // Sync active entries (skip if none above minimum threshold)
  if (entries.length > 0) {
    const userIds = [...new Set(entries.map(e => e.userId))];

    // Process per user (batch limit applies per user)
    for (const userId of userIds) {
      const userEntries = entries
        .filter(e => e.userId === userId)
        .slice(0, SYNC_BATCH_LIMIT);

      try {
        const result = await syncUserIssues(supabaseConfig, organizationId, userId, userEntries);
        synced += result.synced;
        errors += result.errors;
      } catch (userError) {
        console.error(`[ScheduledSync] Failed for user ${userId}:`, userError.message);
        errors++;
      }
    }
  }

  // Always cleanup orphaned worklogs (time reassigned away or dropped below minimum)
  try {
    await cleanupOrphanedWorklogs(supabaseConfig, organizationId, entries);
  } catch (cleanupError) {
    console.error(`[ScheduledSync] Cleanup failed for org ${organizationId}:`, cleanupError.message);
  }

  return { synced, errors };
}

/**
 * Sync a single user's issues to Jira worklogs.
 */
async function syncUserIssues(supabaseConfig, organizationId, userId, entries) {
  // Fetch existing mappings for this user
  const issueKeys = entries.map(e => e.issueKey);
  const keysList = issueKeys.join(',');
  const existingMappings = await supabaseRequest(
    supabaseConfig,
    `worklog_sync?organization_id=eq.${organizationId}&user_id=eq.${userId}&issue_key=in.(${keysList})&select=id,issue_key,jira_worklog_id,last_synced_seconds`
  );

  const mappingByKey = {};
  if (existingMappings && Array.isArray(existingMappings)) {
    existingMappings.forEach(m => { mappingByKey[m.issue_key] = m; });
  }

  let synced = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const mapping = mappingByKey[entry.issueKey];
      const didSync = await syncSingleEntry(supabaseConfig, organizationId, userId, entry, mapping);
      if (didSync) synced++;
    } catch (err) {
      console.error(`[ScheduledSync] Error syncing ${entry.issueKey} for user ${userId}:`, err.message);
      errors++;
    }
  }

  return { synced, errors };
}

/**
 * Sync a single user+issue entry to Jira.
 * @returns {boolean} true if an actual Jira API call was made
 */
async function syncSingleEntry(supabaseConfig, organizationId, userId, entry, existingMapping) {
  const { issueKey, timeTracked, lastWorkedOn } = entry;

  if (existingMapping) {
    if (existingMapping.last_synced_seconds === timeTracked) {
      return false; // No change
    }

    // Try to update existing worklog
    const updateResponse = await updateJiraWorklogAsApp(issueKey, existingMapping.jira_worklog_id, timeTracked);

    if (updateResponse.status === 200) {
      await supabaseRequest(
        supabaseConfig,
        `worklog_sync?id=eq.${existingMapping.id}`,
        { method: 'PATCH', body: { last_synced_seconds: timeTracked, updated_at: new Date().toISOString() } }
      );
      console.log(`[ScheduledSync] Updated ${issueKey} for user ${userId}: ${timeTracked}s`);
      return true;
    }

    if (updateResponse.status === 404) {
      // Stale mapping — delete and re-create
      await supabaseRequest(
        supabaseConfig,
        `worklog_sync?id=eq.${existingMapping.id}`,
        { method: 'DELETE' }
      );
    } else {
      console.error(`[ScheduledSync] Update failed for ${issueKey}: HTTP ${updateResponse.status}`);
      return false;
    }
  }

  // Create new worklog — format date for Jira (requires yyyy-MM-dd'T'HH:mm:ss.SSS+0000)
  // Uses formatStartedForJira to preserve local time from the DB without UTC conversion
  const startedAt = formatStartedForJira(lastWorkedOn);
  const worklogResult = await createJiraWorklogAsApp(issueKey, timeTracked, startedAt);

  if (worklogResult && worklogResult.id) {
    const now = new Date().toISOString();
    await supabaseRequest(
      supabaseConfig,
      'worklog_sync',
      {
        method: 'POST',
        body: {
          organization_id: organizationId,
          user_id: userId,
          issue_key: issueKey,
          jira_worklog_id: String(worklogResult.id),
          last_synced_seconds: timeTracked,
          started_at: startedAt,
          created_at: now,
          updated_at: now
        }
      }
    );
    console.log(`[ScheduledSync] Created worklog for ${issueKey} user ${userId}: ${timeTracked}s`);
    return true;
  }

  // Jira returned an error response (issue deleted, no permission, etc.) — skip gracefully
  if (worklogResult?.errorMessages?.length > 0) {
    console.warn(`[ScheduledSync] Skipping ${issueKey} — ${worklogResult.errorMessages.join(', ')}`);
    return false;
  }

  throw new Error(`Failed to create worklog: ${JSON.stringify(worklogResult)}`);
}

/**
 * Clean up orphaned worklog_sync mappings.
 * When time is reassigned away from an issue, the mapping becomes stale.
 * This finds mappings with no corresponding tracked time and deletes both
 * the Jira worklog and the mapping row.
 */
async function cleanupOrphanedWorklogs(supabaseConfig, organizationId, activeEntries) {
  // Build a set of active user::issueKey pairs
  const activeKeys = new Set(activeEntries.map(e => `${e.userId}::${e.issueKey}`));

  // Fetch all worklog_sync mappings for this org
  const allMappings = await supabaseRequest(
    supabaseConfig,
    `worklog_sync?organization_id=eq.${organizationId}&select=id,user_id,issue_key,jira_worklog_id`
  );

  if (!allMappings || !Array.isArray(allMappings) || allMappings.length === 0) {
    return;
  }

  // Find orphaned mappings (no longer have active tracked time)
  const orphaned = allMappings.filter(m => !activeKeys.has(`${m.user_id}::${m.issue_key}`));

  if (orphaned.length === 0) {
    return;
  }

  console.log(`[ScheduledSync] Found ${orphaned.length} orphaned worklog mappings to clean up`);

  for (const mapping of orphaned) {
    try {
      // Delete the Jira worklog (ignore 404 — already deleted)
      const deleteResponse = await deleteJiraWorklogAsApp(mapping.issue_key, mapping.jira_worklog_id);
      if (deleteResponse.status !== 204 && deleteResponse.status !== 404) {
        console.warn(`[ScheduledSync] Failed to delete Jira worklog ${mapping.jira_worklog_id} for ${mapping.issue_key}: HTTP ${deleteResponse.status}`);
      }

      // Delete the mapping row
      await supabaseRequest(
        supabaseConfig,
        `worklog_sync?id=eq.${mapping.id}`,
        { method: 'DELETE' }
      );
      console.log(`[ScheduledSync] Cleaned up orphaned worklog for ${mapping.issue_key} (user ${mapping.user_id})`);
    } catch (err) {
      console.error(`[ScheduledSync] Cleanup error for ${mapping.issue_key}:`, err.message);
    }
  }
}
