/**
 * Worklog Service
 * Business logic for creating Jira worklogs and syncing in user context.
 */

import { createJiraWorklog, updateJiraWorklog, deleteJiraWorklog } from '../utils/jira.js';
import { getSupabaseConfig, supabaseRequest, getOrCreateOrganization, getOrCreateUser } from '../utils/supabase.js';
import { formatJiraDate } from '../utils/formatters.js';

const MIN_SYNC_SECONDS = 60;

/**
 * Create a worklog entry in Jira (interactive user context).
 * @param {string} issueKey - Jira issue key (e.g., PROJ-123)
 * @param {number} timeSpentSeconds - Time spent in seconds
 * @param {string} startedAt - ISO timestamp when work started
 * @returns {Promise<Object>} Created worklog data
 */
export async function createWorklog(issueKey, timeSpentSeconds, startedAt) {
  return await createJiraWorklog(issueKey, timeSpentSeconds, startedAt);
}

/**
 * Sync the CURRENT USER's tracked time to Jira worklogs.
 *
 * This runs in the user's live Jira session (api.asUser() with no accountId arg),
 * so Jira records the worklog author as the actual user — not the app.
 *
 * Key behaviour:
 *  - If an existing worklog was created by the app (created_as_user = FALSE),
 *    it is deleted and recreated under the user's real name.
 *  - If time hasn't changed since the last sync, the entry is skipped.
 *  - Orphaned worklog mappings (time reassigned away) are cleaned up.
 *
 * Called from the syncMyWorklogs resolver whenever the user opens the
 * project page (with a 15-minute client-side cooldown).
 *
 * @param {string} accountId - Current user's Atlassian account ID
 * @param {string} cloudId   - Jira Cloud ID
 * @returns {Promise<{success: boolean, synced: number, errors: number}>}
 */
export async function syncCurrentUserWorklogs(accountId, cloudId) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    return { success: false, error: 'Supabase not configured' };
  }

  // Check if worklog sync is enabled for this org
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    return { success: false, error: 'Organization not found' };
  }
  const organizationId = organization.id;

  const syncSettings = await supabaseRequest(
    supabaseConfig,
    `tracking_settings?organization_id=eq.${organizationId}&jira_worklog_sync_enabled=eq.true&select=id&limit=1`
  );
  if (!syncSettings || syncSettings.length === 0) {
    return { success: true, synced: 0, errors: 0, message: 'Worklog sync not enabled' };
  }

  const userId = await getOrCreateUser(accountId, supabaseConfig, organizationId);
  if (!userId) {
    return { success: false, error: 'User not found' };
  }

  // Aggregate tracked time for this user across all issues
  const PAGE_SIZE = 1000;
  const timeByIssue = {};
  const lastWorkedByIssue = {};
  let offset = 0;
  let totalFetched = 0;

  while (true) {
    const page = await supabaseRequest(
      supabaseConfig,
      `analysis_results?organization_id=eq.${organizationId}&user_id=eq.${userId}&work_type=eq.office&active_task_key=not.is.null&select=active_task_key,screenshots(duration_seconds,timestamp)&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`
    );

    if (!page || !Array.isArray(page) || page.length === 0) break;

    page.forEach(entry => {
      const key = entry.active_task_key;
      if (!timeByIssue[key]) {
        timeByIssue[key] = 0;
        lastWorkedByIssue[key] = null;
      }
      timeByIssue[key] += entry.screenshots?.duration_seconds || 0;
      const ts = entry.screenshots?.timestamp;
      if (ts && (!lastWorkedByIssue[key] || ts > lastWorkedByIssue[key])) {
        lastWorkedByIssue[key] = ts;
      }
    });

    totalFetched += page.length;
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
    if (totalFetched > 5000) break; // Safety limit per user
  }

  const entries = Object.entries(timeByIssue)
    .filter(([, seconds]) => seconds >= MIN_SYNC_SECONDS)
    .map(([issueKey, seconds]) => ({
      issueKey,
      timeTracked: Math.round(seconds),
      lastWorkedOn: lastWorkedByIssue[issueKey]
    }));

  // Fetch existing worklog_sync mappings for this user
  let existingMappings = [];
  if (entries.length > 0) {
    const issueKeys = entries.map(e => e.issueKey);
    existingMappings = await supabaseRequest(
      supabaseConfig,
      `worklog_sync?organization_id=eq.${organizationId}&user_id=eq.${userId}&issue_key=in.(${issueKeys.join(',')})&select=id,issue_key,jira_worklog_id,last_synced_seconds,created_as_user`
    ) || [];
  }

  const mappingByKey = {};
  existingMappings.forEach(m => { mappingByKey[m.issue_key] = m; });

  let synced = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const didSync = await syncSingleEntryAsCurrentUser(
        supabaseConfig, organizationId, userId, entry, mappingByKey[entry.issueKey]
      );
      if (didSync) synced++;
    } catch (err) {
      console.error(`[UserSync] Error on ${entry.issueKey}:`, err.message);
      errors++;
    }
  }

  // Cleanup orphaned mappings for this user (time reassigned away from issue)
  try {
    const activeIssueKeys = new Set(entries.map(e => e.issueKey));
    const allMappings = await supabaseRequest(
      supabaseConfig,
      `worklog_sync?organization_id=eq.${organizationId}&user_id=eq.${userId}&select=id,issue_key,jira_worklog_id`
    ) || [];

    const orphaned = allMappings.filter(m => !activeIssueKeys.has(m.issue_key));
    for (const orphan of orphaned) {
      try {
        const deleteResp = await deleteJiraWorklog(orphan.issue_key, orphan.jira_worklog_id);
        if (deleteResp.status !== 204 && deleteResp.status !== 404) {
          console.warn(`[UserSync] Cleanup: unexpected HTTP ${deleteResp.status} for ${orphan.issue_key}`);
        }
        await supabaseRequest(supabaseConfig, `worklog_sync?id=eq.${orphan.id}`, { method: 'DELETE' });
      } catch (err) {
        console.error(`[UserSync] Cleanup error for ${orphan.issue_key}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[UserSync] Cleanup failed:', err.message);
  }

  console.log(`[UserSync] Done for user ${userId}. Synced: ${synced}, Errors: ${errors}`);
  return { success: true, synced, errors };
}

/**
 * Sync a single issue entry for the current user.
 * Uses api.asUser() (no accountId) — the live Jira session — so the worklog
 * author is the real user, not the app.
 */
async function syncSingleEntryAsCurrentUser(supabaseConfig, organizationId, userId, entry, existingMapping) {
  const { issueKey, timeTracked, lastWorkedOn } = entry;
  const startedAt = formatJiraDate(lastWorkedOn ? new Date(lastWorkedOn) : new Date());

  if (existingMapping) {
    // Worklog was created by the app (scheduled trigger) — delete and recreate as user
    if (existingMapping.created_as_user === false) {
      console.log(`[UserSync] Migrating app-authored worklog for ${issueKey} to user name`);
      const deleteResp = await deleteJiraWorklog(issueKey, existingMapping.jira_worklog_id);

      if (deleteResp.status !== 204 && deleteResp.status !== 404) {
        // Cannot delete — leave as-is and retry next session
        console.warn(`[UserSync] Cannot migrate ${issueKey}: delete returned HTTP ${deleteResp.status}`);
        return false;
      }

      await supabaseRequest(supabaseConfig, `worklog_sync?id=eq.${existingMapping.id}`, { method: 'DELETE' });
      // Fall through to create fresh worklog as user

    } else if (existingMapping.last_synced_seconds === timeTracked) {
      return false; // No change, skip

    } else {
      // Update existing user-created worklog
      const updateResp = await updateJiraWorklog(issueKey, existingMapping.jira_worklog_id, timeTracked);

      if (updateResp.status === 200) {
        await supabaseRequest(
          supabaseConfig,
          `worklog_sync?id=eq.${existingMapping.id}`,
          { method: 'PATCH', body: { last_synced_seconds: timeTracked, updated_at: new Date().toISOString() } }
        );
        console.log(`[UserSync] Updated ${issueKey}: ${timeTracked}s`);
        return true;
      }

      if (updateResp.status === 404) {
        // Stale mapping, delete and fall through to recreate
        await supabaseRequest(supabaseConfig, `worklog_sync?id=eq.${existingMapping.id}`, { method: 'DELETE' });
      } else {
        console.error(`[UserSync] Update failed for ${issueKey}: HTTP ${updateResp.status}`);
        return false;
      }
    }
  }

  // Create new worklog in the user's live session
  const worklogResult = await createJiraWorklog(issueKey, timeTracked, startedAt);

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
          created_as_user: true,  // Created in interactive user context
          created_at: now,
          updated_at: now
        }
      }
    );
    console.log(`[UserSync] Created worklog for ${issueKey}: ${timeTracked}s`);
    return true;
  }

  if (worklogResult?.errorMessages?.length > 0) {
    console.warn(`[UserSync] Skipping ${issueKey}: ${worklogResult.errorMessages.join(', ')}`);
    return false;
  }

  throw new Error(`Failed to create worklog for ${issueKey}: ${JSON.stringify(worklogResult)}`);
}
