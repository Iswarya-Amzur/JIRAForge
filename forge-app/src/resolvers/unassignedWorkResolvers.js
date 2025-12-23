/**
 * Unassigned Work Resolvers
 * Main registration file for all unassigned work related resolvers
 *
 * This file aggregates and registers all resolvers from the unassigned/ submodules:
 * - sessionResolvers: Fetching unassigned work sessions and groups
 * - assignmentResolvers: Assigning work to issues (existing or new)
 * - projectResolvers: Project and issue dropdown data
 * - notificationResolvers: Desktop notification settings
 * - adminResolvers: Admin-only operations (clustering, roles)
 */

import {
  registerSessionResolvers,
  registerAssignmentResolvers,
  registerProjectResolvers,
  registerNotificationResolvers,
  registerAdminResolvers
} from './unassigned/index.js';

/**
 * Register all unassigned work resolvers
 */
export function registerUnassignedWorkResolvers(resolver) {
  // Session resolvers: getUnassignedWork, getUnassignedGroups, getGroupDetails, getGroupScreenshots
  registerSessionResolvers(resolver);

  // Assignment resolvers: assignToExistingIssue, createIssueAndAssign, previewBulkReassign, bulkReassignByTimeInterval
  registerAssignmentResolvers(resolver);

  // Project resolvers: getUserProjects, getAllUserAssignedIssues, getProjectStatuses
  registerProjectResolvers(resolver);

  // Notification resolvers: getUnassignedNotificationSettings, saveUnassignedNotificationSettings, getUnassignedWorkSummary
  registerNotificationResolvers(resolver);

  // Admin resolvers: triggerClustering, getUserRole
  registerAdminResolvers(resolver);
}
