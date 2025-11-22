/**
 * Permissions Resolvers
 * Resolver definitions for checking user permissions and roles
 */

import { isJiraAdmin, checkUserPermissions, getProjectsUserAdmins } from '../utils/jira.js';

/**
 * Register permissions resolvers
 * @param {Resolver} resolver - Forge resolver instance
 */
export function registerPermissionsResolvers(resolver) {
  /**
   * Resolver for getting user's permissions and role information
   * This is called by the frontend to determine which UI elements to show
   */
  resolver.define('getUserPermissions', async (req) => {
    const { context } = req;
    const accountId = context.accountId;

    try {
      // Check if user is Jira Administrator
      const isAdmin = await isJiraAdmin();

      // Get list of projects where user is Project Admin
      const projectAdminProjects = isAdmin ? [] : await getProjectsUserAdmins();

      // Check basic issue permissions (useful for future features)
      const issuePermissions = await checkUserPermissions(['CREATE_ISSUES', 'EDIT_ISSUES']);

      return {
        success: true,
        permissions: {
          isJiraAdmin: isAdmin,
          projectAdminProjects: projectAdminProjects || [],
          canCreateIssues: issuePermissions.permissions?.CREATE_ISSUES?.havePermission || false,
          canEditIssues: issuePermissions.permissions?.EDIT_ISSUES?.havePermission || false
        }
      };
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return {
        success: false,
        error: error.message,
        permissions: {
          isJiraAdmin: false,
          projectAdminProjects: [],
          canCreateIssues: false,
          canEditIssues: false
        }
      };
    }
  });
}
