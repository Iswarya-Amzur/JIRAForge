/**
 * Issue Service
 * Re-exports all issue service functions from submodules
 *
 * Submodules:
 * - issueQueryService: Fetching and querying issues
 * - issueCacheService: Caching issues in Supabase
 * - issueStateService: Status transitions
 * - sessionService: Session reassignment and screenshots
 */

export { getAssignedIssues, getActiveIssuesWithTime } from './issue/issueQueryService.js';
export { updateAssignedIssuesCache } from './issue/issueCacheService.js';
export { getAvailableTransitions, updateIssueStatus } from './issue/issueStateService.js';
export { reassignSession, getSessionScreenshots } from './issue/sessionService.js';
