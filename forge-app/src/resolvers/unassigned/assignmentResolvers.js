/**
 * Assignment Resolvers for Unassigned Work
 * Handles assigning work sessions to Jira issues
 */

import api, { route } from '@forge/api';
import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest } from '../../utils/supabase.js';
import { getIssueTransitions, transitionIssue } from '../../utils/jira.js';
import { formatDuration, formatJiraDate } from '../../utils/formatters.js';

/**
 * Assign a group of sessions to existing Jira issue
 */
export async function assignToExistingIssue(req) {
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
export async function createIssueAndAssign(req) {
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
 * Preview activities within a time interval for bulk reassignment
 * Returns activities that would be affected by the bulk reassignment
 */
export async function previewBulkReassign(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { selectedDate, startTime, endTime } = req.payload;

    if (!selectedDate || !startTime || !endTime) {
      return { success: false, error: 'Date and time range are required' };
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

    // Build datetime range from selected date and times
    // startTime and endTime are in "HH:mm" format
    const startDateTime = `${selectedDate}T${startTime}:00`;
    const endDateTime = `${selectedDate}T${endTime}:00`;

    console.log(`[previewBulkReassign] Previewing activities from ${startDateTime} to ${endDateTime}`);

    // Query analysis_results within the time range (includes both assigned and unassigned)
    // Use screenshots.timestamp for accurate time-based filtering
    // IMPORTANT: Use screenshots.duration_seconds (source of truth) instead of analysis_results.time_spent_seconds (stale)
    const analysisResults = await supabaseRequest(
      supabaseConfig,
      `analysis_results?select=id,active_task_key,confidence_score,work_type,manually_assigned,screenshots(id,timestamp,window_title,application_name,thumbnail_url,duration_seconds)&user_id=eq.${userId}&organization_id=eq.${organization.id}&work_type=eq.office&order=created_at.asc`
    );

    // Filter by screenshot timestamp within the time range
    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);

    const activitiesInRange = (analysisResults || []).filter(result => {
      const screenshotTimestamp = result.screenshots?.timestamp;
      if (!screenshotTimestamp) return false;

      const activityTime = new Date(screenshotTimestamp);
      return activityTime >= startDate && activityTime <= endDate;
    });

    // Separate into currently assigned (wrongly tracked) and unassigned
    const wronglyTracked = activitiesInRange.filter(a => a.active_task_key !== null);
    const unassigned = activitiesInRange.filter(a => a.active_task_key === null);

    // Calculate totals using screenshots.duration_seconds (source of truth)
    const totalSeconds = activitiesInRange.reduce((sum, a) => sum + (a.screenshots?.duration_seconds || 0), 0);

    // Get unique issue keys that are currently assigned
    const currentlyAssignedIssues = [...new Set(wronglyTracked.map(a => a.active_task_key).filter(Boolean))];

    // Format activities for display - use screenshots.duration_seconds
    const formattedActivities = activitiesInRange.map(a => ({
      id: a.id,
      screenshot_id: a.screenshots?.id,
      timestamp: a.screenshots?.timestamp,
      window_title: a.screenshots?.window_title,
      application_name: a.screenshots?.application_name,
      thumbnail_url: a.screenshots?.thumbnail_url,
      current_issue_key: a.active_task_key,
      time_spent_seconds: a.screenshots?.duration_seconds || 0,
      is_unassigned: a.active_task_key === null
    }));

    return {
      success: true,
      preview: {
        total_activities: activitiesInRange.length,
        wrongly_tracked_count: wronglyTracked.length,
        unassigned_count: unassigned.length,
        total_seconds: totalSeconds,
        total_time_formatted: formatDuration(totalSeconds),
        currently_assigned_issues: currentlyAssignedIssues,
        activities: formattedActivities,
        time_range: {
          start: startDateTime,
          end: endDateTime,
          date: selectedDate
        }
      }
    };

  } catch (error) {
    console.error('Error previewing bulk reassign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk reassign all activities within a time interval to a specific issue
 * Handles both already-tracked (wrongly assigned) and unassigned activities
 */
export async function bulkReassignByTimeInterval(req) {
  try {
    const { accountId, cloudId } = req.context;
    const { selectedDate, startTime, endTime, targetIssueKey, createWorklog = true } = req.payload;

    if (!selectedDate || !startTime || !endTime) {
      return { success: false, error: 'Date and time range are required' };
    }

    if (!targetIssueKey) {
      return { success: false, error: 'Target issue key is required' };
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

    // Build datetime range
    const startDateTime = `${selectedDate}T${startTime}:00`;
    const endDateTime = `${selectedDate}T${endTime}:00`;

    console.log(`[bulkReassignByTimeInterval] Reassigning activities from ${startDateTime} to ${endDateTime} to ${targetIssueKey}`);

    // First, get all analysis_results in the time range
    // IMPORTANT: Use screenshots.duration_seconds (source of truth) instead of analysis_results.time_spent_seconds (stale)
    const analysisResults = await supabaseRequest(
      supabaseConfig,
      `analysis_results?select=id,active_task_key,screenshot_id,screenshots(id,timestamp,duration_seconds)&user_id=eq.${userId}&organization_id=eq.${organization.id}&work_type=eq.office`
    );

    // Filter by screenshot timestamp
    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);

    const activitiesInRange = (analysisResults || []).filter(result => {
      const screenshotTimestamp = result.screenshots?.timestamp;
      if (!screenshotTimestamp) return false;

      const activityTime = new Date(screenshotTimestamp);
      return activityTime >= startDate && activityTime <= endDate;
    });

    if (activitiesInRange.length === 0) {
      return { success: false, error: 'No activities found in the specified time range' };
    }

    const analysisResultIds = activitiesInRange.map(a => a.id);
    // Use screenshots.duration_seconds (source of truth) instead of time_spent_seconds (stale)
    const totalSeconds = activitiesInRange.reduce((sum, a) => sum + (a.screenshots?.duration_seconds || 0), 0);
    const previouslyAssignedCount = activitiesInRange.filter(a => a.active_task_key !== null).length;
    const previouslyUnassignedCount = activitiesInRange.filter(a => a.active_task_key === null).length;

    console.log(`[bulkReassignByTimeInterval] Found ${activitiesInRange.length} activities (${previouslyAssignedCount} tracked, ${previouslyUnassignedCount} unassigned)`);

    // Update all analysis_results to point to the target issue
    const analysisIdsParam = analysisResultIds.join(',');
    await supabaseRequest(
      supabaseConfig,
      `analysis_results?id=in.(${analysisIdsParam})`,
      {
        method: 'PATCH',
        body: {
          active_task_key: targetIssueKey,
          manually_assigned: true,
          assignment_group_id: null // Clear any previous group assignment
        }
      }
    );

    // Also update unassigned_activity table for any activities that exist there
    // First, find matching unassigned_activity records
    const unassignedActivities = await supabaseRequest(
      supabaseConfig,
      `unassigned_activity?analysis_result_id=in.(${analysisIdsParam})&select=id`
    );

    const unassignedArray = Array.isArray(unassignedActivities) ? unassignedActivities : (unassignedActivities ? [unassignedActivities] : []);

    if (unassignedArray.length > 0) {
      const unassignedIds = unassignedArray.map(u => u.id).join(',');
      await supabaseRequest(
        supabaseConfig,
        `unassigned_activity?id=in.(${unassignedIds})`,
        {
          method: 'PATCH',
          body: {
            manually_assigned: true,
            assigned_task_key: targetIssueKey,
            assigned_by: userId,
            assigned_at: new Date().toISOString()
          }
        }
      );
      console.log(`[bulkReassignByTimeInterval] Updated ${unassignedArray.length} unassigned_activity records`);
    }

    // Mark any unassigned_work_groups that contained these activities as assigned
    // First get group IDs from group_members table
    const groupMembers = await supabaseRequest(
      supabaseConfig,
      `unassigned_group_members?unassigned_activity_id=in.(${unassignedArray.map(u => u.id).join(',') || 'null'})&select=group_id`
    );

    const groupMembersArray = Array.isArray(groupMembers) ? groupMembers : (groupMembers ? [groupMembers] : []);
    const uniqueGroupIds = [...new Set(groupMembersArray.map(m => m.group_id).filter(Boolean))];

    if (uniqueGroupIds.length > 0) {
      const groupIdsParam = uniqueGroupIds.join(',');
      await supabaseRequest(
        supabaseConfig,
        `unassigned_work_groups?id=in.(${groupIdsParam})`,
        {
          method: 'PATCH',
          body: {
            is_assigned: true,
            assigned_to_issue_key: targetIssueKey,
            assigned_at: new Date().toISOString(),
            assigned_by: userId
          }
        }
      );
      console.log(`[bulkReassignByTimeInterval] Marked ${uniqueGroupIds.length} groups as assigned`);
    }

    // Create worklog in Jira if requested
    let worklog = null;
    if (createWorklog && totalSeconds > 0) {
      const worklogResponse = await api.asUser().requestJira(
        route`/rest/api/3/issue/${targetIssueKey}/worklog`,
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
                      text: `Bulk time correction: ${activitiesInRange.length} activities (${formatDuration(totalSeconds)}) from ${startTime} to ${endTime} on ${selectedDate} reassigned to this issue.`
                    }
                  ]
                }
              ]
            },
            started: formatJiraDate(new Date(startDateTime))
          })
        }
      );

      if (!worklogResponse.ok) {
        const errorText = await worklogResponse.text();
        console.warn(`[bulkReassignByTimeInterval] Failed to create worklog: ${errorText}`);
        // Don't fail the whole operation if worklog creation fails
      } else {
        worklog = await worklogResponse.json();
        console.log(`[bulkReassignByTimeInterval] Created worklog ${worklog.id} for ${totalSeconds} seconds`);
      }
    }

    return {
      success: true,
      result: {
        total_reassigned: activitiesInRange.length,
        previously_tracked: previouslyAssignedCount,
        previously_unassigned: previouslyUnassignedCount,
        total_seconds: totalSeconds,
        total_time_formatted: formatDuration(totalSeconds),
        target_issue_key: targetIssueKey,
        worklog_id: worklog?.id || null,
        time_range: {
          start: startDateTime,
          end: endDateTime
        }
      }
    };

  } catch (error) {
    console.error('Error in bulk reassign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Register assignment resolvers
 */
export function registerAssignmentResolvers(resolver) {
  resolver.define('assignToExistingIssue', assignToExistingIssue);
  resolver.define('createIssueAndAssign', createIssueAndAssign);
  resolver.define('previewBulkReassign', previewBulkReassign);
  resolver.define('bulkReassignByTimeInterval', bulkReassignByTimeInterval);
}
