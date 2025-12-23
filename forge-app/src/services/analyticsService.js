/**
 * Analytics Service
 * Re-exports all analytics functions from submodules
 *
 * Submodules:
 * - userAnalyticsService: Individual user analytics
 * - orgAnalyticsService: Organization-wide analytics (Admin)
 * - teamAnalyticsService: Project/team analytics
 */

export { fetchTimeAnalytics } from './analytics/userAnalyticsService.js';
export { fetchAllAnalytics } from './analytics/orgAnalyticsService.js';
export { fetchProjectAnalytics, fetchProjectTeamAnalytics } from './analytics/teamAnalyticsService.js';
