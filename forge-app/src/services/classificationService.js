/**
 * Classification Service
 * Business logic for managing application classifications (productive/non_productive/private).
 * Follows the same pattern as projectSettingsService.js.
 */

import { isJiraAdmin, checkUserPermissions } from '../utils/jira.js';
import { getSupabaseConfig, supabaseRequest, getOrCreateOrganization, getOrCreateUser } from '../utils/supabase.js';

/**
 * Get all application classifications for an organization/project
 * Returns global defaults + org overrides + project overrides
 * @param {string} projectKey - Jira project key (optional — null for org-level)
 * @param {string} cloudId - Jira Cloud ID for multi-tenancy
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Array>} Array of classification objects
 */
export async function getClassifications(projectKey, cloudId, accountId) {
  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      console.log('[Classification] Supabase not configured');
      return [];
    }

    let organizationId = null;
    if (cloudId) {
      try {
        const org = await getOrCreateOrganization(cloudId, supabaseConfig);
        organizationId = org?.id;
      } catch (err) {
        console.log('[Classification] Could not get organization');
        return [];
      }
    }

    // Fetch global defaults (organization_id IS NULL, is_default = true)
    const defaults = await supabaseRequest(
      supabaseConfig,
      'application_classifications?is_default=eq.true&organization_id=is.null&order=identifier.asc'
    );

    // Fetch org-level overrides
    let orgOverrides = [];
    if (organizationId) {
      orgOverrides = await supabaseRequest(
        supabaseConfig,
        `application_classifications?organization_id=eq.${organizationId}&project_key=is.null&order=identifier.asc`
      );
    }

    // Fetch project-level overrides
    let projectOverrides = [];
    if (organizationId && projectKey) {
      projectOverrides = await supabaseRequest(
        supabaseConfig,
        `application_classifications?organization_id=eq.${organizationId}&project_key=eq.${projectKey}&order=identifier.asc`
      );
    }

    // Merge: project overrides > org overrides > defaults
    const merged = new Map();

    // Add defaults first
    for (const entry of (defaults || [])) {
      const key = `${entry.identifier}|${entry.match_by}`;
      merged.set(key, { ...entry, source: 'default' });
    }

    // Org overrides replace defaults
    for (const entry of (orgOverrides || [])) {
      const key = `${entry.identifier}|${entry.match_by}`;
      merged.set(key, { ...entry, source: 'organization' });
    }

    // Project overrides replace org
    for (const entry of (projectOverrides || [])) {
      const key = `${entry.identifier}|${entry.match_by}`;
      merged.set(key, { ...entry, source: 'project' });
    }

    // Deduplicate entries that refer to the same real-world application
    // (e.g., "code.exe", "vscode", "Visual Studio Code" are all VS Code)
    const deduped = new Map();
    for (const entry of merged.values()) {
      const normalized = entry.identifier
        .toLowerCase()
        .replace(/\.(exe|app|dmg|msi|deb|rpm|snap|flatpak)$/i, '')
        .replace(/[\s\-_\.]+/g, '');
      const dedupeKey = `${normalized}|${entry.match_by}|${entry.classification}`;
      const existing = deduped.get(dedupeKey);
      if (!existing) {
        deduped.set(dedupeKey, entry);
      } else {
        // Prefer higher-priority source; if equal, prefer one with display_name
        const sourcePriority = { project: 3, organization: 2, default: 1 };
        const existingPriority = sourcePriority[existing.source] || 0;
        const newPriority = sourcePriority[entry.source] || 0;
        if (newPriority > existingPriority) {
          deduped.set(dedupeKey, entry);
        } else if (newPriority === existingPriority && entry.display_name && !existing.display_name) {
          deduped.set(dedupeKey, entry);
        }
      }
    }

    const result = Array.from(deduped.values());
    console.log(`[Classification] Fetched ${result.length} classifications (${(defaults || []).length} defaults, ${(orgOverrides || []).length} org, ${(projectOverrides || []).length} project)`);
    return result;
  } catch (error) {
    console.error('[Classification] Error fetching classifications:', error);
    return [];
  }
}

/**
 * Save (upsert) an application classification
 * @param {Object} classification - Classification data
 * @param {string} projectKey - Jira project key (optional)
 * @param {string} cloudId - Jira Cloud ID
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} Result
 */
export async function saveClassification(classification, projectKey, cloudId, accountId) {
  // Permission check
  const isAdmin = await isJiraAdmin();
  const permissions = await checkUserPermissions(['ADMINISTER_PROJECTS']);
  const isProjectAdmin = permissions.permissions?.ADMINISTER_PROJECTS?.havePermission;

  if (!isAdmin && !isProjectAdmin) {
    throw new Error('Access denied: Only Jira Administrators or Project Administrators can manage classifications');
  }

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured');
  }

  let organizationId = null;
  if (cloudId) {
    const org = await getOrCreateOrganization(cloudId, supabaseConfig);
    organizationId = org?.id;
  }
  if (!organizationId) {
    throw new Error('Organization not found');
  }

  // Input validation
  if (!classification.identifier || !classification.identifier.trim()) {
    throw new Error('Classification identifier is required');
  }
  if (!classification.classification || !['productive', 'non_productive', 'private'].includes(classification.classification)) {
    throw new Error('Classification must be one of: productive, non_productive, private');
  }

  // Resolve Supabase user ID for created_by
  let userId = null;
  if (accountId) {
    try {
      userId = await getOrCreateUser(accountId, supabaseConfig, organizationId);
    } catch (err) {
      console.log('[Classification] Could not resolve user ID:', err.message);
    }
  }

  const data = {
    organization_id: organizationId,
    project_key: projectKey || null,
    identifier: classification.identifier.trim(),
    display_name: classification.displayName || classification.identifier,
    classification: classification.classification,
    match_by: classification.matchBy || 'process',
    is_default: false,
    created_by: userId || accountId,
    updated_at: new Date().toISOString()
  };

  // Check if exists
  let query = `application_classifications?organization_id=eq.${organizationId}&identifier=eq.${encodeURIComponent(data.identifier)}&match_by=eq.${data.match_by}`;
  if (projectKey) {
    query += `&project_key=eq.${projectKey}`;
  } else {
    query += '&project_key=is.null';
  }

  const existing = await supabaseRequest(supabaseConfig, query);

  if (existing && existing.length > 0) {
    // Update
    await supabaseRequest(
      supabaseConfig,
      `application_classifications?id=eq.${existing[0].id}`,
      { method: 'PATCH', body: data }
    );
    console.log(`[Classification] Updated: ${data.identifier} → ${data.classification}`);
  } else {
    // Insert
    data.created_at = new Date().toISOString();
    await supabaseRequest(
      supabaseConfig,
      'application_classifications',
      { method: 'POST', body: data }
    );
    console.log(`[Classification] Created: ${data.identifier} → ${data.classification}`);
  }

  return { success: true, message: `Classification saved for ${data.identifier}` };
}

/**
 * Delete an application classification (org/project override only — cannot delete defaults)
 * @param {string} classificationId - UUID of the classification to delete
 * @param {string} cloudId - Jira Cloud ID
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} Result
 */
export async function deleteClassification(classificationId, cloudId, accountId) {
  const isAdmin = await isJiraAdmin();
  const permissions = await checkUserPermissions(['ADMINISTER_PROJECTS']);
  const isProjectAdmin = permissions.permissions?.ADMINISTER_PROJECTS?.havePermission;

  if (!isAdmin && !isProjectAdmin) {
    throw new Error('Access denied: Only administrators can delete classifications');
  }

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured');
  }

  // Verify it's not a default
  const existing = await supabaseRequest(
    supabaseConfig,
    `application_classifications?id=eq.${classificationId}&limit=1`
  );

  if (!existing || existing.length === 0) {
    throw new Error('Classification not found');
  }

  if (existing[0].is_default) {
    throw new Error('Cannot delete system default classifications. Create an org/project override instead.');
  }

  await supabaseRequest(
    supabaseConfig,
    `application_classifications?id=eq.${classificationId}`,
    { method: 'DELETE' }
  );

  console.log(`[Classification] Deleted classification ${classificationId}`);
  return { success: true, message: 'Classification deleted' };
}

/**
 * Get unknown apps (apps that have been flagged by desktop clients but not yet classified by admin)
 * These show up as activity_records with classification = 'unknown'
 * @param {string} cloudId - Jira Cloud ID
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Array>} Array of unique unknown app entries
 */
export async function getUnknownApps(cloudId, accountId) {
  try {
    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) return [];

    let organizationId = null;
    if (cloudId) {
      const org = await getOrCreateOrganization(cloudId, supabaseConfig);
      organizationId = org?.id;
    }
    if (!organizationId) return [];

    // Get distinct unknown apps from activity_records
    const records = await supabaseRequest(
      supabaseConfig,
      `activity_records?organization_id=eq.${organizationId}&classification=eq.unknown&select=application_name,window_title,metadata&order=created_at.desc&limit=100`
    );

    if (!records || records.length === 0) return [];

    // Deduplicate by application_name
    const seen = new Map();
    for (const record of records) {
      if (!seen.has(record.application_name)) {
        seen.set(record.application_name, {
          applicationName: record.application_name,
          lastWindowTitle: record.window_title,
          suggestedClassification: record.metadata?.suggestedClassification || null,
          confidence: record.metadata?.classificationConfidence || null,
          reasoning: record.metadata?.classificationReasoning || null
        });
      }
    }

    return Array.from(seen.values());
  } catch (error) {
    console.error('[Classification] Error fetching unknown apps:', error);
    return [];
  }
}

/**
 * Bulk import classifications (e.g., from CSV or admin paste)
 * @param {Array} classifications - Array of {identifier, displayName, classification, matchBy}
 * @param {string} projectKey - Project key (optional)
 * @param {string} cloudId - Jira Cloud ID
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} Import result
 */
export async function bulkImportClassifications(classifications, projectKey, cloudId, accountId) {
  const isAdmin = await isJiraAdmin();
  if (!isAdmin) {
    throw new Error('Access denied: Only Jira Administrators can bulk import classifications');
  }

  let successCount = 0;
  let errorCount = 0;

  for (const classification of classifications) {
    try {
      await saveClassification(classification, projectKey, cloudId, accountId);
      successCount++;
    } catch (err) {
      errorCount++;
      console.error(`[Classification] Bulk import error for ${classification.identifier}:`, err.message);
    }
  }

  return {
    success: true,
    message: `Imported ${successCount} classifications, ${errorCount} errors`,
    imported: successCount,
    errors: errorCount
  };
}
