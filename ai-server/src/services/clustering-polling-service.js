/**
 * Clustering Polling Service
 * Periodically checks for unassigned activities and groups them using AI
 */

const supabaseService = require('./supabase-service');
const clusteringService = require('./clustering-service');
const logger = require('../utils/logger');

// Poll every 5 minutes for unassigned activities to cluster
const CLUSTERING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MIN_SESSIONS_FOR_CLUSTERING = 2; // Need at least 2 sessions to cluster
const CLUSTERING_COOLDOWN_HOURS = 24; // Don't re-cluster if already clustered in last 24 hours

let intervalId = null;

/**
 * Main polling function - checks for unassigned activities and clusters them
 */
async function pollAndClusterUnassigned() {
  try {
    logger.info('[Clustering Polling] Starting clustering check...');

    // 1. Get all users who have unassigned activities
    const usersWithUnassigned = await supabaseService.getUsersWithUnassignedWork();

    if (usersWithUnassigned.length === 0) {
      logger.info('[Clustering Polling] No users with unassigned work found');
      return;
    }

    logger.info(`[Clustering Polling] Found ${usersWithUnassigned.length} users with unassigned work`);

    // 2. Process each user separately
    for (const user of usersWithUnassigned) {
      try {
        await processUserUnassignedWork(user.id);
      } catch (error) {
        logger.error(`[Clustering Polling] Error processing user ${user.id}:`, error);
        // Continue with next user even if one fails
      }
    }

    logger.info('[Clustering Polling] Clustering check completed');
  } catch (error) {
    logger.error('[Clustering Polling] Error in clustering polling:', error);
  }
}

/**
 * Process unassigned work for a single user
 * @param {string} userId - User ID to process
 */
async function processUserUnassignedWork(userId) {
  logger.info(`[Clustering Polling] Processing user ${userId}`);

  // 1. Check if user already has recent groups (avoid re-clustering too frequently)
  const recentGroups = await supabaseService.getRecentGroups(userId, CLUSTERING_COOLDOWN_HOURS);
  if (recentGroups.length > 0) {
    logger.info(`[Clustering Polling] User ${userId} already has groups from last ${CLUSTERING_COOLDOWN_HOURS}h, skipping`);
    return;
  }

  // 2. Get unassigned activities for this user
  const sessions = await supabaseService.getUnassignedActivities(userId);

  if (sessions.length < MIN_SESSIONS_FOR_CLUSTERING) {
    logger.info(`[Clustering Polling] User ${userId} has only ${sessions.length} unassigned sessions (need ${MIN_SESSIONS_FOR_CLUSTERING}), skipping`);
    return;
  }

  logger.info(`[Clustering Polling] User ${userId} has ${sessions.length} unassigned sessions, starting clustering...`);

  // 3. Get user's active Jira issues for better AI recommendations
  const userIssues = await supabaseService.getUserActiveIssues(userId);
  logger.info(`[Clustering Polling] Found ${userIssues.length} active issues for user ${userId}`);

  // 4. Cluster sessions using GPT-4
  try {
    const clusteringResult = await clusteringService.clusterUnassignedWork(sessions, userIssues);

    if (!clusteringResult || !clusteringResult.groups || clusteringResult.groups.length === 0) {
      logger.warn(`[Clustering Polling] No groups created for user ${userId}`);
      return;
    }

    logger.info(`[Clustering Polling] Created ${clusteringResult.groups.length} groups for user ${userId}`);

    // 5. Save each group to database
    for (const group of clusteringResult.groups) {
      await saveGroupToDatabase(userId, group);
    }

    logger.info(`[Clustering Polling] Successfully saved ${clusteringResult.groups.length} groups for user ${userId}`);
  } catch (error) {
    logger.error(`[Clustering Polling] Error clustering sessions for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Save a clustered group to the database
 * @param {string} userId - User ID
 * @param {Object} group - Group data from AI clustering
 */
async function saveGroupToDatabase(userId, group) {
  try {
    logger.info(`[Clustering Polling] Saving group "${group.label}" with ${group.session_count} sessions`);

    // 1. Create the group record
    const groupRecord = await supabaseService.createUnassignedGroup({
      user_id: userId,
      group_label: group.label,
      group_description: group.description,
      confidence_level: group.confidence,
      recommended_action: group.recommendation?.action || 'create_new_issue',
      suggested_issue_key: group.recommendation?.suggested_issue_key || null,
      recommendation_reason: group.recommendation?.reason || '',
      session_count: group.session_count,
      total_seconds: group.total_seconds,
      clustering_metadata: {
        session_indices: group.session_indices,
        total_time_formatted: group.total_time_formatted,
        full_group_data: group
      }
    });

    // 2. Add each session as a group member
    const sessionIds = group.session_ids || [];
    for (const sessionId of sessionIds) {
      try {
        await supabaseService.addGroupMember({
          group_id: groupRecord.id,
          unassigned_activity_id: sessionId
        });
      } catch (error) {
        logger.error(`[Clustering Polling] Error adding session ${sessionId} to group ${groupRecord.id}:`, error);
        // Continue with other sessions even if one fails
      }
    }

    logger.info(`[Clustering Polling] Successfully saved group ${groupRecord.id} with ${sessionIds.length} members`);
    return groupRecord;
  } catch (error) {
    logger.error(`[Clustering Polling] Error saving group to database:`, error);
    throw error;
  }
}

/**
 * Start the clustering polling service
 */
function start() {
  if (intervalId) {
    logger.warn('[Clustering Polling] Service already running');
    return;
  }

  logger.info('[Clustering Polling] Starting unassigned work clustering service...');
  logger.info(`[Clustering Polling] Interval: ${CLUSTERING_INTERVAL / 1000 / 60} minutes`);
  logger.info(`[Clustering Polling] Minimum sessions: ${MIN_SESSIONS_FOR_CLUSTERING}`);
  logger.info(`[Clustering Polling] Cooldown period: ${CLUSTERING_COOLDOWN_HOURS} hours`);

  // Run immediately on start
  pollAndClusterUnassigned().catch(error => {
    logger.error('[Clustering Polling] Error in initial clustering run:', error);
  });

  // Then run on interval
  intervalId = setInterval(() => {
    pollAndClusterUnassigned().catch(error => {
      logger.error('[Clustering Polling] Error in clustering interval:', error);
    });
  }, CLUSTERING_INTERVAL);

  logger.info('[Clustering Polling] Service started successfully');
}

/**
 * Stop the clustering polling service
 */
function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[Clustering Polling] Service stopped');
  }
}

module.exports = {
  start,
  stop,
  pollAndClusterUnassigned, // Exported for manual testing
  processUserUnassignedWork  // Exported for manual testing
};
