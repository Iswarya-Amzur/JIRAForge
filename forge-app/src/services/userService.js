/**
 * User Service
 * Business logic for user information and profile
 */

import { isJiraAdmin, checkUserPermissions, getProjectsUserAdmins } from '../utils/jira.js';
import api, { route } from '@forge/api';

/**
 * Get comprehensive user information including Jira profile and permissions
 * @param {string} accountId - Atlassian account ID
 * @returns {Promise<Object>} Complete user profile with permissions
 */
export async function getCurrentUserInfo(accountId) {
  try {
    // 1. Get user details from Jira's /user endpoint with expanded groups and roles
    // Using /user with accountId instead of /myself to get full group/role data
    const userResponse = await api.asUser().requestJira(
      route`/rest/api/3/user?accountId=${accountId}&expand=groups,applicationRoles`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    const jiraUser = await userResponse.json();

    // 2. Get permissions
    const isAdmin = await isJiraAdmin();
    const projectAdminProjects = isAdmin ? [] : await getProjectsUserAdmins();
    const issuePermissions = await checkUserPermissions(['CREATE_ISSUES', 'EDIT_ISSUES']);

    // 3. Combine all user information
    return {
      user: {
        // Jira User Info
        accountId: jiraUser.accountId,
        accountType: jiraUser.accountType,
        email: jiraUser.emailAddress,
        displayName: jiraUser.displayName,
        avatarUrl: jiraUser.avatarUrls?.['48x48'] || jiraUser.avatarUrls?.['32x32'] || null,
        active: jiraUser.active,
        timeZone: jiraUser.timeZone,
        locale: jiraUser.locale,

        // Permissions
        role: isAdmin ? 'admin' : (projectAdminProjects.length > 0 ? 'project_admin' : 'user'),
        permissions: {
          isJiraAdmin: isAdmin,
          projectAdminProjects: projectAdminProjects || [],
          canCreateIssues: issuePermissions.permissions?.CREATE_ISSUES?.havePermission || false,
          canEditIssues: issuePermissions.permissions?.EDIT_ISSUES?.havePermission || false
        },

        // Additional Info
        groups: jiraUser.groups?.items?.map(g => g.name) || [],
        applicationRoles: jiraUser.applicationRoles?.items?.map(r => r.key) || []
      }
    };
  } catch (error) {
    console.error('Error fetching current user info:', error);
    throw new Error('Failed to fetch user information: ' + error.message);
  }
}
