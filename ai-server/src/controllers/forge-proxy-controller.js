/**
 * Forge Proxy Controller
 * Handles Supabase operations proxied from the Forge app
 * All requests are authenticated via Forge Invocation Token (FIT)
 */

const logger = require('../utils/logger');
const { getClient } = require('../services/db/supabase-client');

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
      case 'UPDATE':
        // Build update query with filters
        let updateBuilder = supabase.from(table).update(body);
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
