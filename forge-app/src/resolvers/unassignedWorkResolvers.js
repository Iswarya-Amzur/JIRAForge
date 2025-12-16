/**
 * Unassigned Work Resolvers
 * Handles operations for clustering and assigning unassigned work sessions
 */

import api, { route } from '@forge/api';
import { fetch } from '@forge/api';
import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest, getUserOrganizationMembership } from '../utils/supabase.js';
import { getAllUserAssignedIssues as getAllUserAssignedIssuesUtil, formatIssuesData, getIssueTransitions, transitionIssue } from '../utils/jira.js';
import { getUserSettings } from '../services/settingsService.js';

/**
 * Get unassigned work sessions for current user
 */
async function getUnassignedWork(req) {
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
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format date for Jira worklog started field
 * Jira requires format: yyyy-MM-dd'T'HH:mm:ss.SSSZ
 * Using UTC time and formatting with +0000 instead of Z
 */
function formatJiraDate(date = new Date()) {
  const d = new Date(date);
  
  // Use UTC components
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(d.getUTCMilliseconds()).padStart(3, '0');
  
  // Format: yyyy-MM-dd'T'HH:mm:ss.SSS+0000 (Jira prefers +0000 over Z)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+0000`;
}

/**
 * Get already-clustered groups from database (AI server creates these automatically)
 */
async function getUnassignedGroups(req) {
  try {
    const { accountId, cloudId } = req.context;

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

    // Fetch unassigned groups for this user - filter by organization_id for multi-tenancy
    const groups = await supabaseRequest(
      supabaseConfig,
      `unassigned_work_groups?user_id=eq.${userId}&organization_id=eq.${organization.id}&is_assigned=eq.false&order=created_at.desc`
    );

    if (!groups || groups.length === 0) {
      return { success: true, groups: [], total_groups: 0 };
    }

    // For each group, fetch its members and enrich with formatted data
    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        // Fetch members with unassigned_activity_id
        const members = await supabaseRequest(
          supabaseConfig,
          `unassigned_group_members?group_id=eq.${group.id}&select=id,unassigned_activity_id`
        );

        // Ensure members is an array
        const membersArray = Array.isArray(members) ? members : (members ? [members] : []);
        
        console.log(`[getUnassignedGroups] Group ${group.id} has ${membersArray.length} members`, 
          membersArray.length > 0 ? `First member: ${JSON.stringify(membersArray[0])}` : 'No members');

        // Calculate total_seconds from ACTUAL member activities (not DB value which may be wrong)
        // Always recalculate to ensure accuracy
        let totalSeconds = 0;

        if (membersArray.length > 0) {
          const activityIds = membersArray.map(m => m?.unassigned_activity_id).filter(Boolean);
          if (activityIds.length > 0) {
            const activityIdsParam = activityIds.join(',');
            const activities = await supabaseRequest(
              supabaseConfig,
              `unassigned_activity?id=in.(${activityIdsParam})&select=time_spent_seconds`
            );
            const activitiesArray = Array.isArray(activities) ? activities : (activities ? [activities] : []);
            totalSeconds = activitiesArray.reduce((sum, a) => sum + (a?.time_spent_seconds || 0), 0);
          }
        }

        const totalTimeFormatted = formatDuration(totalSeconds);

        // Format recommendation data
        const recommendation = group.recommended_action ? {
          action: group.recommended_action,
          suggested_issue_key: group.suggested_issue_key || null,
          reason: group.recommendation_reason || ''
        } : null;

        // Filter out null/undefined session IDs and ensure we have valid UUIDs
        // Try multiple ways to extract the ID
        let validSessionIds = membersArray
          .map(m => {
            // Try different possible field names
            return m?.unassigned_activity_id || m?.id || m?.activity_id;
          })
          .filter(id => {
            // Validate it's a non-empty string that looks like a UUID
            if (!id || typeof id !== 'string' || id.trim() === '') return false;
            // Basic UUID format check (8-4-4-4-12 hex characters)
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
          });
        
        // Fallback: If no valid session IDs but we have members, try re-querying
        if (validSessionIds.length === 0 && membersArray.length > 0) {
          console.warn(`[getUnassignedGroups] Group ${group.id} has ${membersArray.length} members but no valid session IDs. Trying fallback...`);
          console.warn(`[getUnassignedGroups] Sample member data:`, JSON.stringify(membersArray[0]));
          
          // Try to get unassigned_activity records using the member junction table IDs
          try {
            // Re-query with just unassigned_activity_id to see if the field name is different
            const allMembers = await supabaseRequest(
              supabaseConfig,
              `unassigned_group_members?group_id=eq.${group.id}&select=*`
            );
            
            const allMembersArray = Array.isArray(allMembers) ? allMembers : (allMembers ? [allMembers] : []);
            console.log(`[getUnassignedGroups] Fallback: Found ${allMembersArray.length} members with full data`);
            
            // Try to extract from full data
            validSessionIds = allMembersArray
              .map(m => m?.unassigned_activity_id || m?.id)
              .filter(id => {
                if (!id || typeof id !== 'string' || id.trim() === '') return false;
                return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
              });
            
            if (validSessionIds.length > 0) {
              console.log(`[getUnassignedGroups] Fallback successful: Found ${validSessionIds.length} session IDs for group ${group.id}`);
            } else {
              console.warn(`[getUnassignedGroups] Fallback also found no valid session IDs. Full member sample:`, 
                JSON.stringify(allMembersArray[0]));
            }
          } catch (fallbackError) {
            console.error(`[getUnassignedGroups] Fallback query failed for group ${group.id}:`, fallbackError.message);
          }
        }
        
        console.log(`[getUnassignedGroups] Group ${group.id} final result: ${validSessionIds.length} valid session IDs (members: ${membersArray.length}, session_count: ${group.session_count || 0})`);
        
        if (validSessionIds.length === 0 && (membersArray.length > 0 || (group.session_count && group.session_count > 0))) {
          console.warn(`[getUnassignedGroups] WARNING: Group ${group.id} has ${membersArray.length} members and session_count=${group.session_count} but no valid session IDs!`);
        }
        
        return {
          ...group,
          label: group.group_label, // Map group_label to label for UI
          description: group.group_description, // Map group_description to description for UI
          session_ids: validSessionIds,
          session_count: validSessionIds.length || 0, // Use ACTUAL valid session count, not DB value
          total_seconds: totalSeconds, // Recalculated from actual members
          total_time_formatted: totalTimeFormatted,
          confidence: group.confidence_level || 'medium', // Map confidence_level to confidence
          recommendation: recommendation,
          has_valid_sessions: validSessionIds.length > 0 // Flag to indicate if group has usable sessions
        };
      })
    );

    // Filter out groups with no valid session IDs (data inconsistency - group exists but no members)
    const validGroups = enrichedGroups.filter(g => g.has_valid_sessions);
    
    if (validGroups.length < enrichedGroups.length) {
      console.warn(`[getUnassignedGroups] Filtered out ${enrichedGroups.length - validGroups.length} groups with no valid session IDs`);
    }

    return {
      success: true,
      groups: validGroups,
      total_groups: validGroups.length
    };

  } catch (error) {
    console.error('Error getting unassigned groups:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Assign a group of sessions to existing Jira issue
 */
async function assignToExistingIssue(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { sessionIds, issueKey, groupId, totalSeconds } = req.payload;

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return { success: false, error: 'No sessions provided' };
    }

    if (!issueKey) {
      return { success: false, error: 'No issue key provided' };
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

    // 1. Update unassigned_activity records and fetch analysis_result_ids
    // PostgREST in operator doesn't need quotes around UUIDs - just comma-separated values
    // Filter out any invalid IDs
    const validSessionIds = sessionIds.filter(id => id && typeof id === 'string');
    if (validSessionIds.length === 0) {
      return { success: false, error: 'No valid session IDs provided' };
    }

    const sessionIdsParam = validSessionIds.join(',');
    console.log(`[assignToExistingIssue] Updating ${validSessionIds.length} sessions for issue ${issueKey}`);
    
    const updatedActivities = await supabaseRequest(
      supabaseConfig,
      `unassigned_activity?id=in.(${sessionIdsParam})&select=analysis_result_id`,
      {
        method: 'PATCH',
        headers: {
          'Prefer': 'return=representation' // Return updated rows
        },
        body: {
          manually_assigned: true,
          assigned_task_key: issueKey,
          assigned_by: userId,
          assigned_at: new Date().toISOString()
        }
      }
    );

    // 2. Get analysis_result_ids from the updated activities
    // Handle both array and single object responses
    const activitiesArray = Array.isArray(updatedActivities) ? updatedActivities : (updatedActivities ? [updatedActivities] : []);
    const analysisResultIds = activitiesArray.map(a => a?.analysis_result_id).filter(Boolean);

    console.log(`[assignToExistingIssue] Found ${analysisResultIds.length} analysis results to update`);

    // 3. Update analysis_results to mark sessions as assigned
    if (analysisResultIds.length > 0) {
      const analysisIdsParam = analysisResultIds.join(',');
      // Only include assignment_group_id if groupId is a valid UUID
      const updateBody = {
        active_task_key: issueKey,
        manually_assigned: true
      };
      
      // Validate groupId is a valid UUID format before including it
      if (groupId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
        updateBody.assignment_group_id = groupId;
      }
      
      await supabaseRequest(
        supabaseConfig,
        `analysis_results?id=in.(${analysisIdsParam})`,
        {
          method: 'PATCH',
          body: updateBody
        }
      );
    } else {
      console.warn(`[assignToExistingIssue] No analysis_result_ids found for ${validSessionIds.length} sessions`);
    }

    // 4. Mark the group as assigned (only if groupId is a valid UUID)
    if (groupId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
      await supabaseRequest(
        supabaseConfig,
        `unassigned_work_groups?id=eq.${groupId}`,
        {
          method: 'PATCH',
          body: {
            is_assigned: true,
            assigned_to_issue_key: issueKey,
            assigned_at: new Date().toISOString(),
            assigned_by: userId
          }
        }
      );
    }

    // 5. Create worklog in Jira
    const worklogResponse = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}/worklog`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeSpentSeconds: totalSeconds,
          comment: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `Time tracked from ${sessionIds.length} work session(s), grouped and assigned manually.`
                  }
                ]
              }
            ]
          },
          started: formatJiraDate()
        })
      }
    );

    let worklog = null;
    if (!worklogResponse.ok) {
      const errorText = await worklogResponse.text();
      throw new Error(`Failed to create worklog: ${errorText}`);
    } else {
      worklog = await worklogResponse.json();
    }

    return {
      success: true,
      assigned_count: sessionIds.length,
      worklog_id: worklog?.id || null,
      issue_key: issueKey
    };

  } catch (error) {
    console.error('Error assigning to existing issue:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create new Jira issue and assign work group to it
 */
async function createIssueAndAssign(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { sessionIds, issueSummary, issueDescription, projectKey, issueType, totalSeconds, groupId, assigneeAccountId, statusName } = req.payload;

    if (!sessionIds || sessionIds.length === 0) {
      return { success: false, error: 'No sessions provided' };
    }

    if (!issueSummary) {
      return { success: false, error: 'Issue summary required' };
    }

    if (!projectKey) {
      return { success: false, error: 'Project key required' };
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

    // Build issue fields
    const issueFields = {
      project: { key: projectKey },
      summary: issueSummary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: issueDescription || `Work performed across ${sessionIds.length} sessions.\n\nTotal time: ${formatDuration(totalSeconds)}\n\nCreated from time tracking data.`
              }
            ]
          }
        ]
      },
      issuetype: { name: issueType || 'Task' },
      labels: ['time-tracked', 'auto-created']
    };

    // Add assignee if provided (default to current user)
    if (assigneeAccountId) {
      issueFields.assignee = { accountId: assigneeAccountId };
    } else {
      // Default to current user
      issueFields.assignee = { accountId: accountId };
    }

    // Note: Cannot set status during creation - must transition after creation
    // Create new Jira issue
    const createIssueResponse = await api.asUser().requestJira(
      route`/rest/api/3/issue`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: issueFields
        })
      }
    );

    if (!createIssueResponse.ok) {
      const errorText = await createIssueResponse.text();
      throw new Error(`Failed to create issue: ${errorText}`);
    }

    const newIssue = await createIssueResponse.json();
    const newIssueKey = newIssue.key;

    // Transition issue to desired status if provided
    if (statusName) {
      try {
        // Get available transitions for the newly created issue
        const transitions = await getIssueTransitions(newIssueKey);
        
        // Find transition that leads to the desired status
        const targetTransition = transitions.find(t => 
          t.to && t.to.name && t.to.name.toLowerCase() === statusName.toLowerCase()
        );
        
        if (targetTransition) {
          // Execute the transition
          await transitionIssue(newIssueKey, targetTransition.id);
          console.log(`[createIssueAndAssign] Successfully transitioned ${newIssueKey} to ${statusName}`);
        } else {
          console.warn(`[createIssueAndAssign] Could not find transition to status "${statusName}" for ${newIssueKey}. Available transitions:`, 
            transitions.map(t => t.to?.name).filter(Boolean));
          // Don't fail the whole operation if transition fails
        }
      } catch (transitionError) {
        console.warn(`[createIssueAndAssign] Failed to transition ${newIssueKey} to ${statusName}:`, transitionError.message);
        // Don't fail the whole operation if transition fails - issue was created successfully
      }
    }

    // Update unassigned_activity records and get analysis_result_ids
    // PostgREST in operator doesn't need quotes around UUIDs
    const validSessionIds = sessionIds.filter(id => id && typeof id === 'string');
    if (validSessionIds.length === 0) {
      return { success: false, error: 'No valid session IDs provided' };
    }

    const sessionIdsParam = validSessionIds.join(',');
    console.log(`[createIssueAndAssign] Updating ${validSessionIds.length} sessions for new issue ${newIssueKey}`);
    
    const updatedActivities = await supabaseRequest(
      supabaseConfig,
      `unassigned_activity?id=in.(${sessionIdsParam})&select=analysis_result_id`,
      {
        method: 'PATCH',
        headers: {
          'Prefer': 'return=representation' // Return updated rows
        },
        body: {
          manually_assigned: true,
          assigned_task_key: newIssueKey,
          assigned_by: userId,
          assigned_at: new Date().toISOString()
        }
      }
    );

    // Get analysis_result_ids - handle both array and single object responses
    const activitiesArray = Array.isArray(updatedActivities) ? updatedActivities : (updatedActivities ? [updatedActivities] : []);
    const analysisResultIds = activitiesArray.map(a => a?.analysis_result_id).filter(Boolean);
    
    console.log(`[createIssueAndAssign] Found ${analysisResultIds.length} analysis results to update`);

    // Update analysis_results to mark sessions as assigned to new issue
    if (analysisResultIds.length > 0) {
      const analysisIdsParam = analysisResultIds.join(',');
      // Only include assignment_group_id if groupId is a valid UUID
      const updateBody = {
        active_task_key: newIssueKey,
        manually_assigned: true
      };
      
      // Validate groupId is a valid UUID format before including it
      if (groupId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
        updateBody.assignment_group_id = groupId;
      }
      
      await supabaseRequest(
        supabaseConfig,
        `analysis_results?id=in.(${analysisIdsParam})`,
        {
          method: 'PATCH',
          body: updateBody
        }
      );
    }

    // Create worklog on new issue
    const worklogResponse = await api.asUser().requestJira(
      route`/rest/api/3/issue/${newIssueKey}/worklog`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeSpentSeconds: totalSeconds,
          comment: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `Initial time logged from ${sessionIds.length} work session(s).`
                  }
                ]
              }
            ]
          },
          started: formatJiraDate()
        })
      }
    );

    let worklog = null;
    if (!worklogResponse.ok) {
      const errorText = await worklogResponse.text();
      console.warn(`Created issue ${newIssueKey} but failed to add worklog: ${errorText}`);
    } else {
      worklog = await worklogResponse.json();
    }

    // Cache the new issue for future AI analysis - include organization_id for multi-tenancy
    await supabaseRequest(
      supabaseConfig,
      'user_jira_issues_cache',
      {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: {
          user_id: userId,
          organization_id: organization.id,
          issue_key: newIssueKey,
          summary: issueSummary,
          status: 'To Do',
          project_key: projectKey
        }
      }
    );

    // Log created issue - include organization_id for multi-tenancy
    const logBody = {
      user_id: userId,
      organization_id: organization.id,
      issue_key: newIssueKey,
      issue_summary: issueSummary,
      session_count: sessionIds.length,
      total_time_seconds: totalSeconds
    };

    // Only include assignment_group_id if groupId is a valid UUID
    if (groupId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
      logBody.assignment_group_id = groupId;
    }

    await supabaseRequest(
      supabaseConfig,
      'created_issues_log',
      {
        method: 'POST',
        body: logBody
      }
    );

    return {
      success: true,
      issue_key: newIssueKey,
      issue_id: newIssue.id,
      assigned_count: sessionIds.length,
      worklog_id: worklog?.id
    };

  } catch (error) {
    console.error('Error creating issue and assigning work:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's projects (for create issue dropdown)
 */
async function getUserProjects(req) {
  try {
    const response = await api.asUser().requestJira(
      route`/rest/api/3/project`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    const projects = await response.json();

    return {
      success: true,
      projects: projects.map(p => ({
        key: p.key,
        name: p.name,
        id: p.id
      }))
    };

  } catch (error) {
    console.error('Error getting user projects:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get ALL user's assigned issues (for assign to existing issue dropdown)
 * Returns all issues regardless of status
 */
async function getAllUserAssignedIssues(req) {
  try {
    const jiraData = await getAllUserAssignedIssuesUtil(50); // Max 50 issues for dropdown
    
    return {
      success: true,
      issues: formatIssuesData(jiraData.issues || []).map(issue => ({
        key: issue.key,
        summary: issue.summary,
        status: issue.status
      }))
    };

  } catch (error) {
    console.error('Error getting all user assigned issues:', error);
    return { 
      success: false, 
      error: error.message,
      issues: []
    };
  }
}

/**
 * Get available statuses for a project (for create issue dropdown)
 */
async function getProjectStatuses(req) {
  try {
    const { projectKey } = req.payload;
    
    if (!projectKey) {
      return { success: false, error: 'Project key required' };
    }

    // Get available statuses for this project
    const statusResponse = await api.asUser().requestJira(
      route`/rest/api/3/project/${projectKey}/statuses`,
      { method: 'GET' }
    );

    if (!statusResponse.ok) {
      // Fallback: return common statuses
      return {
        success: true,
        statuses: [
          { name: 'To Do', id: '1' },
          { name: 'In Progress', id: '3' },
          { name: 'Done', id: '10001' }
        ]
      };
    }

    const statusesData = await statusResponse.json();
    
    // Extract unique statuses from all issue types
    const statusMap = new Map();
    statusesData.forEach(issueTypeStatus => {
      issueTypeStatus.statuses.forEach(status => {
        if (!statusMap.has(status.name)) {
          statusMap.set(status.name, {
            name: status.name,
            id: status.id
          });
        }
      });
    });

    return {
      success: true,
      statuses: Array.from(statusMap.values())
    };

  } catch (error) {
    console.error('Error getting project statuses:', error);
    // Return common statuses as fallback
    return {
      success: true,
      statuses: [
        { name: 'To Do', id: '1' },
        { name: 'In Progress', id: '3' },
        { name: 'Done', id: '10001' }
      ]
    };
  }
}


/**
 * Get screenshots for unassigned work group
 */
async function getGroupScreenshots(req) {
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
    const { generateSignedUrl } = await import('../utils/supabase.js');
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
 * Trigger clustering for the organization (Admin only)
 * Calls the AI server to group unassigned activities
 */
async function triggerClustering(req) {
  try {
    const { accountId, cloudId } = req.context;

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

    // Check if user is admin/owner
    const membership = await getUserOrganizationMembership(userId, organization.id, supabaseConfig);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return { 
        success: false, 
        error: 'Access denied. Only organization admins can trigger clustering.' 
      };
    }

    // Get AI server settings
    const settings = await getUserSettings(accountId);
    if (!settings.aiServerUrl) {
      return { success: false, error: 'AI Server URL not configured. Please configure it in Settings.' };
    }

    console.log(`[triggerClustering] Admin ${accountId} triggering clustering for org ${organization.id}`);

    // Call AI server to trigger organization-wide clustering
    const response = await fetch(`${settings.aiServerUrl}/api/trigger-org-clustering`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.aiServerApiKey || ''}`
      },
      body: JSON.stringify({
        organizationId: organization.id
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[triggerClustering] AI server error:', errorData);
      return { 
        success: false, 
        error: errorData.error || `AI server returned status ${response.status}` 
      };
    }

    const result = await response.json();
    console.log('[triggerClustering] AI server response:', result);

    return {
      success: true,
      message: result.message || 'Clustering completed successfully',
      usersProcessed: result.usersProcessed || 0,
      errors: result.errors || 0
    };

  } catch (error) {
    console.error('Error triggering clustering:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's role and permissions for the current organization
 */
async function getUserRole(req) {
  console.log('[getUserRole] Starting...');
  try {
    const { accountId, cloudId } = req.context;
    console.log('[getUserRole] accountId:', accountId, 'cloudId:', cloudId);

    const supabaseConfig = await getSupabaseConfig(accountId);
    if (!supabaseConfig) {
      console.log('[getUserRole] Supabase not configured');
      return { success: false, error: 'Supabase not configured' };
    }

    // Get or create organization first (multi-tenancy)
    const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
    if (!organization) {
      console.log('[getUserRole] Unable to get organization');
      return { success: false, error: 'Unable to get organization information' };
    }
    console.log('[getUserRole] Organization:', organization.id);

    const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
    console.log('[getUserRole] User ID:', userId);

    // Get user's membership
    const membership = await getUserOrganizationMembership(userId, organization.id, supabaseConfig);
    console.log('[getUserRole] Membership:', JSON.stringify(membership));
    
    const role = membership?.role || 'member';
    const canTriggerClustering = ['owner', 'admin'].includes(role);
    console.log('[getUserRole] Role:', role, 'canTriggerClustering:', canTriggerClustering);
    
    return {
      success: true,
      role: role,
      permissions: {
        canManageSettings: membership?.can_manage_settings || false,
        canViewTeamAnalytics: membership?.can_view_team_analytics || false,
        canManageMembers: membership?.can_manage_members || false,
        canTriggerClustering: canTriggerClustering
      }
    };

  } catch (error) {
    console.error('Error getting user role:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get notification settings for unassigned work reminders
 */
async function getUnassignedNotificationSettings(req) {
  try {
    const { accountId, cloudId } = req.context;

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

    // Get user's settings from the users table
    const users = await supabaseRequest(
      supabaseConfig,
      `users?id=eq.${userId}&select=settings`
    );

    if (users && users.length > 0 && users[0].settings) {
      const settings = users[0].settings;
      return {
        success: true,
        settings: {
          unassignedWorkNotificationsEnabled: settings.unassigned_work_notifications_enabled ?? true,
          notificationIntervalHours: settings.notification_interval_hours ?? 4,
          minUnassignedMinutes: settings.min_unassigned_minutes ?? 30
        }
      };
    }

    // Return defaults
    return {
      success: true,
      settings: {
        unassignedWorkNotificationsEnabled: true,
        notificationIntervalHours: 4,
        minUnassignedMinutes: 30
      }
    };

  } catch (error) {
    console.error('Error getting notification settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save notification settings for unassigned work reminders
 */
async function saveUnassignedNotificationSettings(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { settings } = req.payload;

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

    // Get current user settings
    const users = await supabaseRequest(
      supabaseConfig,
      `users?id=eq.${userId}&select=settings`
    );

    const currentSettings = (users && users.length > 0 && users[0].settings) ? users[0].settings : {};

    // Merge new notification settings into existing settings
    const updatedSettings = {
      ...currentSettings,
      unassigned_work_notifications_enabled: settings.unassignedWorkNotificationsEnabled ?? true,
      notification_interval_hours: settings.notificationIntervalHours ?? 4,
      min_unassigned_minutes: settings.minUnassignedMinutes ?? 30
    };

    // Update user settings
    await supabaseRequest(
      supabaseConfig,
      `users?id=eq.${userId}`,
      {
        method: 'PATCH',
        body: {
          settings: updatedSettings
        }
      }
    );

    return {
      success: true,
      message: 'Notification settings saved successfully'
    };

  } catch (error) {
    console.error('Error saving notification settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get unassigned work summary (for desktop app notifications)
 */
async function getUnassignedWorkSummary(req) {
  try {
    const { accountId, cloudId } = req.context;

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

    // Get count of unassigned groups
    const groups = await supabaseRequest(
      supabaseConfig,
      `unassigned_work_groups?user_id=eq.${userId}&organization_id=eq.${organization.id}&is_assigned=eq.false&select=id,total_seconds`
    );

    const groupsArray = Array.isArray(groups) ? groups : (groups ? [groups] : []);
    const totalGroups = groupsArray.length;
    const totalSeconds = groupsArray.reduce((sum, g) => sum + (g.total_seconds || 0), 0);

    return {
      success: true,
      summary: {
        pendingGroups: totalGroups,
        totalUnassignedSeconds: totalSeconds,
        totalUnassignedMinutes: Math.round(totalSeconds / 60),
        totalUnassignedHours: Math.round(totalSeconds / 3600 * 10) / 10
      }
    };

  } catch (error) {
    console.error('Error getting unassigned work summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Register all unassigned work resolvers
 */
export function registerUnassignedWorkResolvers(resolver) {
  resolver.define('getUnassignedWork', getUnassignedWork);
  resolver.define('getUnassignedGroups', getUnassignedGroups); // New: Read groups from DB instead of clustering
  resolver.define('getGroupScreenshots', getGroupScreenshots); // Get screenshots for a group
  resolver.define('assignToExistingIssue', assignToExistingIssue);
  resolver.define('createIssueAndAssign', createIssueAndAssign);
  resolver.define('getUserProjects', getUserProjects);
  resolver.define('getAllUserAssignedIssues', getAllUserAssignedIssues); // For the assign modal dropdown - returns ALL issues
  resolver.define('getProjectStatuses', getProjectStatuses); // Get available statuses for a project
  resolver.define('triggerClustering', triggerClustering); // Admin: Manually trigger clustering
  resolver.define('getUserRole', getUserRole); // Get user's role and permissions
  resolver.define('getUnassignedNotificationSettings', getUnassignedNotificationSettings); // Get notification settings
  resolver.define('saveUnassignedNotificationSettings', saveUnassignedNotificationSettings); // Save notification settings
  resolver.define('getUnassignedWorkSummary', getUnassignedWorkSummary); // Get summary for desktop notifications
}
