/**
 * Forge Proxy Controller
 * Handles Supabase operations proxied from the Forge app
 * All requests are authenticated via Forge Invocation Token (FIT)
 */

const logger = require('../utils/logger');
const { getClient } = require('../services/db/supabase-client');
const sessionStore = require('../services/feedback-session-store');

/**
 * Generic Supabase REST API proxy
 * Handles any table operation from the Forge app
 */
exports.supabaseQuery = async (req, res) => {
  try {
    const { table, method, query, body, select } = req.body;
    const { cloudId, accountId } = req.forgeContext;

    if (!table) {
      return res.status(400).json({
        success: false,
        error: 'Table name is required'
      });
    }

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    logger.info('[ForgeProxy] Supabase query', {
      table,
      method: method || 'GET',
      cloudId
    });

    // SECURITY: Tables that require organization_id filtering for multi-tenancy
    const SENSITIVE_TABLES = [
      'screenshots', 'analysis_results', 'users', 'documents', 'worklogs',
      'activity_log', 'unassigned_activity', 'unassigned_work_groups',
      'user_jira_issues_cache', 'created_issues_log', 'daily_time_summary',
      'weekly_time_summary', 'project_time_summary', 'tracking_settings',
      'organization_settings', 'organization_members'
    ];

    // Check if query includes organization_id filter for sensitive tables
    const hasOrgFilter = query?.eq?.organization_id ||
                         query?.eq?.jira_cloud_id ||
                         body?.organization_id ||
                         body?.jira_cloud_id;

    if (SENSITIVE_TABLES.includes(table) && !hasOrgFilter) {
      // For GET requests without org filter, this is a potential data leak
      if (!method || method === 'GET' || method === 'SELECT') {
        logger.warn('[ForgeProxy] SECURITY: Query to sensitive table without organization filter', {
          table,
          cloudId,
          accountId,
          queryFilters: Object.keys(query?.eq || {})
        });
      }
      // For write operations, require organization_id
      if (method === 'POST' || method === 'INSERT') {
        logger.warn('[ForgeProxy] SECURITY: INSERT to sensitive table without organization_id', {
          table,
          cloudId
        });
      }
    }

    let queryBuilder = supabase.from(table);

    // Apply select columns if specified (from body or query._select)
    const selectColumns = select || query?._select;
    if (selectColumns) {
      queryBuilder = queryBuilder.select(selectColumns);
    } else if (method === 'GET' || !method) {
      queryBuilder = queryBuilder.select('*');
    }

    // Reserved PostgREST query parameters that should not be used as column names
    const RESERVED_PARAMS = ['order', 'limit', 'offset', 'select', 'on_conflict'];

    // Apply filters from query object (only for GET/SELECT - PATCH/DELETE handle their own filters)
    const upperMethod = (method || 'GET').toUpperCase();
    if (query && (upperMethod === 'GET' || upperMethod === 'SELECT')) {
      for (const [key, value] of Object.entries(query)) {
        if (key === 'eq') {
          for (const [col, val] of Object.entries(value)) {
            // Skip reserved parameters that were incorrectly parsed as filters
            if (RESERVED_PARAMS.includes(col)) {
              logger.warn('[ForgeProxy] Skipping reserved parameter as filter', { col, val });
              // Try to handle 'order' specially if it looks like "column.direction"
              if (col === 'order' && typeof val === 'string') {
                const dotIndex = val.lastIndexOf('.');
                if (dotIndex > 0) {
                  const column = val.substring(0, dotIndex);
                  const direction = val.substring(dotIndex + 1);
                  queryBuilder = queryBuilder.order(column, { ascending: direction !== 'desc' });
                }
              }
              continue;
            }
            queryBuilder = queryBuilder.eq(col, val);
          }
        } else if (key === 'neq') {
          for (const [col, val] of Object.entries(value)) {
            if (RESERVED_PARAMS.includes(col)) {
              logger.warn('[ForgeProxy] Skipping reserved parameter as neq filter', { col, val });
              continue;
            }
            queryBuilder = queryBuilder.neq(col, val);
          }
        } else if (key === 'gt') {
          for (const [col, val] of Object.entries(value)) {
            queryBuilder = queryBuilder.gt(col, val);
          }
        } else if (key === 'gte') {
          for (const [col, val] of Object.entries(value)) {
            queryBuilder = queryBuilder.gte(col, val);
          }
        } else if (key === 'lt') {
          for (const [col, val] of Object.entries(value)) {
            queryBuilder = queryBuilder.lt(col, val);
          }
        } else if (key === 'lte') {
          for (const [col, val] of Object.entries(value)) {
            queryBuilder = queryBuilder.lte(col, val);
          }
        } else if (key === 'in') {
          for (const [col, val] of Object.entries(value)) {
            queryBuilder = queryBuilder.in(col, val);
          }
        } else if (key === 'is') {
          for (const [col, val] of Object.entries(value)) {
            queryBuilder = queryBuilder.is(col, val);
          }
        } else if (key === 'not') {
          // Handle negated filters (e.g., not.is.null)
          for (const [col, filterDef] of Object.entries(value)) {
            queryBuilder = queryBuilder.not(col, filterDef.operator, filterDef.value);
          }
        } else if (key === 'order') {
          queryBuilder = queryBuilder.order(value.column, { ascending: value.ascending ?? true });
        } else if (key === 'limit') {
          queryBuilder = queryBuilder.limit(value);
        } else if (key === 'offset') {
          queryBuilder = queryBuilder.range(value, value + (query.limit || 1000) - 1);
        } else if (key === '_select') {
          // Select is handled separately in the initial query builder setup
          continue;
        } else if (key === 'single') {
          queryBuilder = queryBuilder.single();
        } else if (key === 'maybeSingle') {
          queryBuilder = queryBuilder.maybeSingle();
        }
      }
    }

    // Execute based on method
    let result;
    switch (upperMethod) {
      case 'GET':
      case 'SELECT':
        result = await queryBuilder;
        break;
      case 'POST':
      case 'INSERT':
        result = await supabase.from(table).insert(body).select();
        break;
      case 'PATCH':
      case 'UPDATE': {
        // Ensure body is an object (Forge sends deleted_at/status for screenshot soft-delete)
        const updatePayload = body && typeof body === 'object' ? body : {};
        if (table === 'screenshots' && (updatePayload.deleted_at != null || updatePayload.status === 'deleted')) {
          logger.info('[ForgeProxy] Screenshot soft-delete', {
            screenshotId: query?.eq?.id,
            deleted_at: updatePayload.deleted_at,
            status: updatePayload.status
          });
          // Ensure updated_at is set when soft-deleting so the row is clearly modified
          if (updatePayload.deleted_at != null && updatePayload.updated_at == null) {
            updatePayload.updated_at = new Date().toISOString();
          }
        }
        let updateBuilder = supabase.from(table).update(updatePayload);
        // Apply eq filters
        if (query?.eq) {
          for (const [col, val] of Object.entries(query.eq)) {
            updateBuilder = updateBuilder.eq(col, val);
          }
        }
        // Apply in filters (for bulk updates like id=in.(uuid1,uuid2,...))
        if (query?.in) {
          for (const [col, val] of Object.entries(query.in)) {
            updateBuilder = updateBuilder.in(col, val);
          }
        }
        // Apply is filters (for null checks)
        if (query?.is) {
          for (const [col, val] of Object.entries(query.is)) {
            updateBuilder = updateBuilder.is(col, val);
          }
        }
        result = await updateBuilder.select();
        break;
      }
      case 'DELETE':
        let deleteBuilder = supabase.from(table).delete();
        // Apply eq filters
        if (query?.eq) {
          for (const [col, val] of Object.entries(query.eq)) {
            deleteBuilder = deleteBuilder.eq(col, val);
          }
        }
        // Apply in filters (for bulk deletes like id=in.(uuid1,uuid2,...))
        if (query?.in) {
          for (const [col, val] of Object.entries(query.in)) {
            deleteBuilder = deleteBuilder.in(col, val);
          }
        }
        // Apply is filters (for null checks)
        if (query?.is) {
          for (const [col, val] of Object.entries(query.is)) {
            deleteBuilder = deleteBuilder.is(col, val);
          }
        }
        result = await deleteBuilder;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported method: ${method}`
        });
    }

    if (result.error) {
      logger.error('[ForgeProxy] Supabase error', {
        table,
        error: result.error.message
      });
      return res.status(400).json({
        success: false,
        error: result.error.message
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('[ForgeProxy] Query error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get or create organization by Jira Cloud ID
 */
exports.getOrCreateOrganization = async (req, res) => {
  try {
    const { cloudId } = req.forgeContext;
    const { orgName, jiraUrl } = req.body;

    // Validate cloudId - required for organization lookup/creation
    if (!cloudId) {
      logger.error('[ForgeProxy] Missing cloudId in forgeContext');
      return res.status(400).json({
        success: false,
        error: 'Missing cloudId in authentication context. Please re-authenticate.'
      });
    }

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    logger.info('[ForgeProxy] Get/Create organization', { cloudId });

    // Try to find existing organization
    const { data: existingOrgs, error: findError } = await supabase
      .from('organizations')
      .select('*')
      .eq('jira_cloud_id', cloudId);

    if (findError) {
      throw findError;
    }

    if (existingOrgs && existingOrgs.length > 0) {
      const existingOrg = existingOrgs[0];
      
      // Update organization if we have better info now (fix "Unknown Organization" issue)
      if (orgName && orgName !== 'Unknown Organization' && 
          (existingOrg.org_name === 'Unknown Organization' || 
           existingOrg.jira_instance_url?.includes(cloudId))) {
        logger.info('[ForgeProxy] Updating organization with better info', { 
          id: existingOrg.id, 
          oldName: existingOrg.org_name, 
          newName: orgName 
        });
        
        const { data: updatedOrg, error: updateError } = await supabase
          .from('organizations')
          .update({
            org_name: orgName,
            jira_instance_url: jiraUrl || existingOrg.jira_instance_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOrg.id)
          .select()
          .single();
        
        if (!updateError && updatedOrg) {
          return res.json({
            success: true,
            data: updatedOrg
          });
        }
      }
      
      logger.info('[ForgeProxy] Found existing organization', { id: existingOrg.id });
      return res.json({
        success: true,
        data: existingOrg
      });
    }

    // Create new organization
    const { data: newOrg, error: createError } = await supabase
      .from('organizations')
      .insert({
        jira_cloud_id: cloudId,
        org_name: orgName || 'Unknown Organization',
        jira_instance_url: jiraUrl || `https://${cloudId}.atlassian.net`,
        subscription_status: 'active',
        subscription_tier: 'free'
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // Create default organization settings
    await supabase
      .from('organization_settings')
      .insert({
        organization_id: newOrg.id,
        screenshot_interval: 300,
        auto_worklog_enabled: true
      });

    logger.info('[ForgeProxy] Created new organization', { id: newOrg.id });

    res.json({
      success: true,
      data: newOrg
    });
  } catch (error) {
    logger.error('[ForgeProxy] Organization error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get or create user by Atlassian account ID
 */
exports.getOrCreateUser = async (req, res) => {
  try {
    const { accountId, cloudId } = req.forgeContext;
    const { organizationId, email, displayName } = req.body;

    // Validate accountId - required for user creation
    if (!accountId) {
      logger.error('[ForgeProxy] Missing accountId in forgeContext', { cloudId });
      return res.status(400).json({
        success: false,
        error: 'Missing accountId in authentication context. Please re-authenticate.'
      });
    }

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    logger.info('[ForgeProxy] Get/Create user', { accountId, cloudId });

    // Try to find existing user
    const { data: existingUsers, error: findError } = await supabase
      .from('users')
      .select('id, organization_id, email, display_name')
      .eq('atlassian_account_id', accountId);

    if (findError) {
      throw findError;
    }

    if (existingUsers && existingUsers.length > 0) {
      const user = existingUsers[0];
      let updated = false;

      // Update organization_id if provided and different
      if (organizationId && user.organization_id !== organizationId) {
        await supabase
          .from('users')
          .update({ organization_id: organizationId })
          .eq('id', user.id);
        updated = true;

        // Ensure organization membership
        await ensureOrganizationMembership(supabase, user.id, organizationId);
      }

      // Update user details if missing
      if ((!user.email || !user.display_name) && (email || displayName)) {
        await supabase
          .from('users')
          .update({
            email: email || user.email,
            display_name: displayName || user.display_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        updated = true;
      }

      logger.info('[ForgeProxy] Found existing user', { id: user.id, updated });

      return res.json({
        success: true,
        data: { userId: user.id }
      });
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        atlassian_account_id: accountId,
        organization_id: organizationId,
        email: email || null,
        display_name: displayName || null
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // Create organization membership
    if (organizationId) {
      await ensureOrganizationMembership(supabase, newUser.id, organizationId);
    }

    logger.info('[ForgeProxy] Created new user', { id: newUser.id });

    res.json({
      success: true,
      data: { userId: newUser.id }
    });
  } catch (error) {
    logger.error('[ForgeProxy] User error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get user's organization membership
 */
exports.getOrganizationMembership = async (req, res) => {
  try {
    const { userId, organizationId } = req.body;

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('[ForgeProxy] Membership error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Storage operations - Upload file
 */
exports.storageUpload = async (req, res) => {
  try {
    const { bucket, path, data, contentType } = req.body;
    const { cloudId } = req.forgeContext;

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    logger.info('[ForgeProxy] Storage upload', { bucket, path, cloudId });

    // Convert base64 data to buffer
    const buffer = Buffer.from(data, 'base64');

    const { data: uploadData, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: true
      });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: uploadData
    });
  } catch (error) {
    logger.error('[ForgeProxy] Storage upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Storage operations - Generate signed URL
 */
exports.storageSignedUrl = async (req, res) => {
  try {
    const { bucket, path, expiresIn } = req.body;

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn || 3600);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: { signedUrl: data.signedUrl }
    });
  } catch (error) {
    logger.error('[ForgeProxy] Signed URL error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Storage operations - Delete file
 */
exports.storageDelete = async (req, res) => {
  try {
    const { bucket, path } = req.body;

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw error;
    }

    res.json({
      success: true
    });
  } catch (error) {
    logger.error('[ForgeProxy] Storage delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Ensure organization membership exists
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User UUID
 * @param {string} organizationId - Organization UUID
 */
async function ensureOrganizationMembership(supabase, userId, organizationId) {
  try {
    // Check if membership exists
    const { data: existing } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (existing && existing.length > 0) {
      return;
    }

    // Check if this is the first member
    const { data: allMembers } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId);

    const isFirstUser = !allMembers || allMembers.length === 0;
    const role = isFirstUser ? 'owner' : 'member';

    // Create membership
    await supabase
      .from('organization_members')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        role: role,
        can_manage_settings: ['owner', 'admin'].includes(role),
        can_view_team_analytics: ['owner', 'admin', 'manager'].includes(role),
        can_manage_members: ['owner', 'admin'].includes(role),
        can_delete_screenshots: ['owner', 'admin'].includes(role),
        can_manage_billing: role === 'owner'
      });

    logger.info('[ForgeProxy] Created organization membership', { userId, organizationId, role });
  } catch (error) {
    logger.error('[ForgeProxy] Membership creation error:', error);
  }
}

/**
 * Batch Dashboard Endpoint
 * Fetches all data needed for the dashboard in a single request
 * Reduces 8+ API calls to 1, significantly improving performance
 */
exports.getDashboardData = async (req, res) => {
  try {
    const { cloudId, accountId } = req.forgeContext;
    const { 
      canViewAllUsers = false,  // Whether user has admin privileges
      isJiraAdmin = false,      // Whether user is Jira admin (sees all data)
      projectKeys = null,       // For project admins: array of project keys to filter by; for Jira admins: null (no project restriction)
      maxDailySummaryDays = 30,
      maxWeeklySummaryWeeks = 12,
      maxIssuesInAnalytics = 50
    } = req.body;

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Determine if we should filter by specific projects
    // Project admins (not Jira admins) should only see their projects' data
    const isProjectAdmin = canViewAllUsers && !isJiraAdmin;
    const hasValidProjectKeys = Array.isArray(projectKeys) && projectKeys.length > 0;
    const shouldFilterByProjects = isProjectAdmin && hasValidProjectKeys;
    
    // Security: If user is project admin but has empty/missing projectKeys, reject the request
    // This prevents accidental exposure of org-wide data when project discovery fails
    if (isProjectAdmin && !hasValidProjectKeys) {
      logger.warn('[ForgeProxy] Project admin with no valid projectKeys - rejecting', { cloudId, accountId });
      return res.status(403).json({
        success: false,
        error: 'Project admin access requires valid project keys. No projects found for your admin permissions.'
      });
    }
    
    logger.info('[ForgeProxy] Dashboard batch request', { 
      cloudId, 
      accountId,
      isJiraAdmin,
      shouldFilterByProjects,
      projectKeysCount: shouldFilterByProjects ? projectKeys.length : 'all'
    });

    // 1. Get or verify organization
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('jira_cloud_id', cloudId);

    if (orgError) throw orgError;
    if (!orgs || orgs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found. Please reload the page.'
      });
    }
    const organization = orgs[0];

    // 2. Get or verify user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, organization_id, email, display_name')
      .eq('atlassian_account_id', accountId);

    if (userError) throw userError;
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. Please reload the page.'
      });
    }
    const user = users[0];
    const userId = user.id;

    // 3. Get membership in a single query
    const { data: membership } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organization.id)
      .single();

    // Determine if user can view all data
    const canViewTeamData = canViewAllUsers || membership?.can_view_team_analytics || false;

    // 4. Execute all data queries in PARALLEL for maximum performance
    const queries = [];

    // Daily summary
    const dailyQuery = supabase
      .from('daily_time_summary')
      .select('*')
      .eq('organization_id', organization.id)
      .order('work_date', { ascending: false })
      .limit(maxDailySummaryDays);
    
    if (!canViewTeamData) {
      dailyQuery.eq('user_id', userId);
    } else if (shouldFilterByProjects) {
      // Project admins only see data from their projects
      dailyQuery.in('project_key', projectKeys);
    }
    queries.push(dailyQuery);

    // Weekly summary
    const weeklyQuery = supabase
      .from('weekly_time_summary')
      .select('*')
      .eq('organization_id', organization.id)
      .order('week_start', { ascending: false })
      .limit(maxWeeklySummaryWeeks);
    
    if (!canViewTeamData) {
      weeklyQuery.eq('user_id', userId);
    } else if (shouldFilterByProjects) {
      // Project admins only see data from their projects
      weeklyQuery.in('project_key', projectKeys);
    }
    queries.push(weeklyQuery);

    // Project summary
    const projectQuery = supabase
      .from('project_time_summary')
      .select('*')
      .eq('organization_id', organization.id)
      .order('total_seconds', { ascending: false });
    
    if (shouldFilterByProjects) {
      // Project admins only see their projects
      projectQuery.in('project_key', projectKeys);
    }
    queries.push(projectQuery);

    // Analysis results with issue data
    const analysisQuery = supabase
      .from('analysis_results')
      .select('active_task_key, active_project_key, work_type, screenshots(duration_seconds)')
      .eq('organization_id', organization.id)
      .not('active_task_key', 'is', null)
      .order('created_at', { ascending: false });
    
    if (!canViewTeamData) {
      analysisQuery.eq('user_id', userId);
    } else if (shouldFilterByProjects) {
      // Project admins only see issues from their projects
      analysisQuery.in('active_project_key', projectKeys);
    }
    queries.push(analysisQuery);

    // All active users (for team view)
    // For project admins, we need to get users who have tracked time on their projects
    let usersQuery;
    if (!canViewTeamData) {
      usersQuery = Promise.resolve({ data: [{ id: userId, display_name: user.display_name, email: user.email }] });
    } else if (shouldFilterByProjects) {
      // Get users who have time tracked on the project admin's projects
      // Using daily_time_summary with time window to limit data volume
      // Calculate date range matching the dashboard query (last N days)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxDailySummaryDays);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      usersQuery = supabase
        .from('daily_time_summary')
        .select('user_id')
        .eq('organization_id', organization.id)
        .in('project_key', projectKeys)
        .gte('work_date', cutoffDateStr) // Limit to recent data only
        .then(async (result) => {
          if (result.error) throw result.error;
          // Get unique user IDs
          const userIds = [...new Set((result.data || []).map(r => r.user_id))];
          if (userIds.length === 0) {
            return { data: [] };
          }
          // Fetch the actual user details
          return supabase
            .from('users')
            .select('id, display_name, email')
            .in('id', userIds)
            .eq('organization_id', organization.id)
            .eq('is_active', true);
        });
    } else {
      // Jira admin or org admin - see all users
      usersQuery = supabase
        .from('users')
        .select('id, display_name, email')
        .eq('organization_id', organization.id)
        .eq('is_active', true);
    }
    queries.push(usersQuery);

    // Execute all queries in parallel
    const [
      dailyResult,
      weeklyResult,
      projectResult,
      analysisResult,
      allUsersResult
    ] = await Promise.all(queries);

    // Process analysis results to aggregate time by issue
    const timeByIssue = aggregateTimeByIssue(
      analysisResult.data || [], 
      maxIssuesInAnalytics
    );

    logger.info('[ForgeProxy] Dashboard batch complete', { 
      cloudId,
      dailyCount: dailyResult.data?.length || 0,
      weeklyCount: weeklyResult.data?.length || 0,
      projectCount: projectResult.data?.length || 0
    });

    res.json({
      success: true,
      data: {
        // Organization info - matching legacy format
        organizationId: organization.id,
        organizationName: organization.org_name,
        // User info
        userId: userId,
        userDisplayName: user.display_name,
        userEmail: user.email,
        // Membership info
        membership: membership || null,
        canViewAllUsers: canViewTeamData,
        // Analytics data - matching legacy format exactly
        dailySummary: dailyResult.data || [],
        weeklySummary: weeklyResult.data || [],
        timeByProject: projectResult.data || [],
        timeByIssue: timeByIssue,
        allUsers: allUsersResult.data || []
      }
    });
  } catch (error) {
    logger.error('[ForgeProxy] Dashboard batch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get latest app version for Forge app
 * Returns the latest desktop app version info for update notifications
 */
exports.getLatestAppVersion = async (req, res) => {
  try {
    const { platform = 'windows', currentVersion } = req.body;
    const { cloudId } = req.forgeContext;

    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    logger.info('[ForgeProxy] Getting latest app version', { platform, currentVersion, cloudId });

    // Get the latest release for the platform
    const { data: release, error } = await supabase
      .from('app_releases')
      .select('version, download_url, release_notes, is_mandatory, min_supported_version, file_size_bytes, published_at')
      .eq('platform', platform.toLowerCase())
      .eq('is_latest', true)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If no release found, return default
    if (!release) {
      return res.json({
        success: true,
        data: {
          latestVersion: '1.0.0',
          downloadUrl: null,
          releaseNotes: null,
          updateAvailable: false,
          isMandatory: false
        }
      });
    }

    // Compare versions if current version provided
    let updateAvailable = false;
    if (currentVersion) {
      updateAvailable = isNewerVersion(release.version, currentVersion);
    }

    res.json({
      success: true,
      data: {
        latestVersion: release.version,
        downloadUrl: release.download_url,
        releaseNotes: release.release_notes,
        isMandatory: release.is_mandatory,
        minSupportedVersion: release.min_supported_version,
        fileSizeBytes: release.file_size_bytes,
        publishedAt: release.published_at,
        updateAvailable,
        currentVersion: currentVersion || null
      }
    });

  } catch (error) {
    logger.error('[ForgeProxy] Get latest app version error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Compare two semantic versions
 * @param {string} v1 - Version to compare
 * @param {string} v2 - Version to compare against
 * @returns {boolean} True if v1 is newer than v2
 */
function isNewerVersion(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  
  return false; // Versions are equal
}

/**
 * Helper function to aggregate time by issue
 * @param {Array} results - Analysis results with screenshots
 * @param {number} limit - Maximum issues to return
 * @returns {Array} Aggregated time by issue
 */
function aggregateTimeByIssue(results, limit) {
  const issueAggregation = {};
  
  results.forEach(result => {
    const key = result.active_task_key;
    if (!key) return;
    
    if (!issueAggregation[key]) {
      issueAggregation[key] = {
        issueKey: key,
        projectKey: result.active_project_key,
        totalSeconds: 0
      };
    }
    issueAggregation[key].totalSeconds += result.screenshots?.duration_seconds || 0;
  });

  return Object.values(issueAggregation)
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, limit);
}

/**
 * Create feedback session for Forge app
 * Uses FIT-authenticated context to get user info from Jira API
 * Returns a feedback URL that can be opened in a new browser tab
 *
 * POST /api/forge/feedback/session
 */
exports.createFeedbackSession = async (req, res) => {
  try {
    const { cloudId, accountId } = req.forgeContext;

    if (!cloudId || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'Missing cloudId or accountId in authentication context'
      });
    }

    // Get user info from our database (already synced from Jira)
    const supabase = getClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Find user by Atlassian account ID
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('email, display_name')
      .eq('atlassian_account_id', accountId)
      .limit(1);

    if (userError) {
      logger.error('[ForgeProxy] Error fetching user for feedback:', userError);
    }

    const user = users?.[0];
    const userEmail = user?.email || `${accountId}@atlassian.user`;
    const userName = user?.display_name || 'Forge App User';

    // Create session using the existing feedback session store
    const sessionId = sessionStore.createSession({
      atlassianToken: null, // Not needed - we use FIT auth
      cloudId: cloudId,
      userInfo: {
        account_id: accountId,
        email: userEmail,
        name: userName
      }
    });

    // Build feedback form URL (using /api prefix so nginx forwards to AI server)
    const protocol = req.protocol;
    const host = req.get('host');
    const feedbackUrl = `${protocol}://${host}/api/feedback/form?session=${sessionId}`;

    logger.info('[ForgeProxy] Feedback session created for Forge user %s', accountId);

    res.json({
      success: true,
      data: {
        feedbackUrl,
        sessionId
      }
    });

  } catch (error) {
    logger.error('[ForgeProxy] Feedback session creation error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to create feedback session: ${error.message}`
    });
  }
};

