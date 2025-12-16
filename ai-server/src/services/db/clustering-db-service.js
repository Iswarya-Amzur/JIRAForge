/**
 * Clustering Database Service Module
 * Handles unassigned work clustering and grouping operations
 */

const { getClient } = require('./supabase-client');
const logger = require('../../utils/logger');

/**
 * Get all users who have unassigned activities (grouped by user and organization)
 * @returns {Promise<Array>} Array of user objects with unassigned work and their organization
 */
async function getUsersWithUnassignedWork() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('unassigned_activity')
      .select('user_id, organization_id')
      .eq('manually_assigned', false)
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    // Get unique user_id + organization_id combinations
    const uniqueCombos = new Map();
    data.forEach(item => {
      const key = `${item.user_id}_${item.organization_id}`;
      if (!uniqueCombos.has(key)) {
        uniqueCombos.set(key, { id: item.user_id, organization_id: item.organization_id });
      }
    });

    return Array.from(uniqueCombos.values());
  } catch (error) {
    logger.error('Error fetching users with unassigned work:', error);
    return [];
  }
}

/**
 * Get unassigned activities for a specific user within an organization
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID for multi-tenancy filtering
 * @returns {Promise<Array>} Array of unassigned activity sessions
 */
async function getUnassignedActivities(userId, organizationId) {
  try {
    const supabase = getClient();
    let query = supabase
      .from('unassigned_activity')
      .select(`
        id,
        screenshot_id,
        timestamp,
        window_title,
        application_name,
        extracted_text,
        time_spent_seconds,
        reason,
        confidence_score,
        metadata,
        analysis_result_id,
        organization_id
      `)
      .eq('user_id', userId)
      .eq('manually_assigned', false)
      .order('timestamp', { ascending: false });

    // Filter by organization if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Fetch analysis_metadata for each activity to get AI reasoning
    const enrichedData = await Promise.all(
      data.map(async (activity) => {
        const { data: analysisData } = await supabase
          .from('analysis_results')
          .select('analysis_metadata')
          .eq('id', activity.analysis_result_id)
          .single();

        return {
          ...activity,
          reasoning: analysisData?.analysis_metadata?.reasoning || 'No description available'
        };
      })
    );

    return enrichedData;
  } catch (error) {
    logger.error('Error fetching unassigned activities:', error);
    throw new Error(`Failed to fetch unassigned activities: ${error.message}`);
  }
}

/**
 * Check if user has recent groups (to avoid re-clustering too frequently)
 * @param {string} userId - User ID
 * @param {number} hoursAgo - How many hours ago to check
 * @param {string} organizationId - Organization ID for multi-tenancy filtering
 * @returns {Promise<Array>} Recent groups
 */
async function getRecentGroups(userId, hoursAgo = 24, organizationId = null) {
  try {
    const supabase = getClient();
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('unassigned_work_groups')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', cutoffTime);

    // Filter by organization if provided
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching recent groups:', error);
    return [];
  }
}

/**
 * Create a new unassigned work group
 * @param {Object} groupData - Group data from AI clustering (should include organization_id)
 * @returns {Promise<Object>} Created group record
 */
async function createUnassignedGroup(groupData) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('unassigned_work_groups')
      .insert({
        user_id: groupData.user_id,
        organization_id: groupData.organization_id,
        group_label: groupData.group_label,
        group_description: groupData.group_description,
        confidence_level: groupData.confidence_level,
        recommended_action: groupData.recommended_action,
        suggested_issue_key: groupData.suggested_issue_key,
        recommendation_reason: groupData.recommendation_reason,
        session_count: groupData.session_count,
        total_seconds: groupData.total_seconds,
        clustering_metadata: groupData.clustering_metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info(`Created unassigned group: ${data.id} for user ${groupData.user_id} in org ${groupData.organization_id}`);
    return data;
  } catch (error) {
    logger.error('Error creating unassigned group:', error);
    throw new Error(`Failed to create unassigned group: ${error.message}`);
  }
}

/**
 * Add a member to an unassigned work group
 * @param {Object} memberData - Member data
 * @returns {Promise<Object|null>} Created member record or null if duplicate
 */
async function addGroupMember(memberData) {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('unassigned_group_members')
      .insert({
        group_id: memberData.group_id,
        unassigned_activity_id: memberData.unassigned_activity_id
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate key errors gracefully - activity may already be in a group
      if (error.code === '23505') { // PostgreSQL unique violation code
        logger.warn(`Activity ${memberData.unassigned_activity_id} already assigned to a group, skipping`);
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error adding group member:', error);
    throw new Error(`Failed to add group member: ${error.message}`);
  }
}

/**
 * Get the timestamp of the most recent clustering run
 * Uses the latest unassigned_work_groups created_at as a proxy
 * @returns {Promise<Date|null>} Last clustering run time or null if never run
 */
async function getLastClusteringRunTime() {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('unassigned_work_groups')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No groups exist yet - clustering has never run
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data ? new Date(data.created_at) : null;
  } catch (error) {
    logger.error('Error getting last clustering run time:', error);
    return null;
  }
}

/**
 * Check if clustering has run within the specified hours
 * @param {number} hours - Number of hours to check
 * @returns {Promise<boolean>} True if clustering has run within the specified hours
 */
async function hasClusteringRunRecently(hours = 24) {
  try {
    const lastRunTime = await getLastClusteringRunTime();

    if (!lastRunTime) {
      return false; // Never run
    }

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    return lastRunTime > cutoffTime;
  } catch (error) {
    logger.error('Error checking clustering run time:', error);
    return false; // Assume not run recently on error
  }
}

/**
 * Get count of unassigned activities that haven't been grouped yet
 * @returns {Promise<number>} Count of ungrouped unassigned activities
 */
async function getUngroupedActivityCount() {
  try {
    const supabase = getClient();
    // Get activities that are not manually assigned and not in any group
    const { count, error } = await supabase
      .from('unassigned_activity')
      .select('id', { count: 'exact', head: true })
      .eq('manually_assigned', false);

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    logger.error('Error getting ungrouped activity count:', error);
    return 0;
  }
}

/**
 * Get unassigned work groups for a user
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Array of groups with their members
 */
async function getUnassignedWorkGroups(userId, organizationId = null) {
  try {
    const supabase = getClient();
    let query = supabase
      .from('unassigned_work_groups')
      .select(`
        *,
        unassigned_group_members (
          id,
          unassigned_activity_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching unassigned work groups:', error);
    return [];
  }
}

module.exports = {
  getUsersWithUnassignedWork,
  getUnassignedActivities,
  getRecentGroups,
  createUnassignedGroup,
  addGroupMember,
  getLastClusteringRunTime,
  hasClusteringRunRecently,
  getUngroupedActivityCount,
  getUnassignedWorkGroups
};
