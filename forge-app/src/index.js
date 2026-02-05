/**
 * Main entry point for the Forge app
 * This file registers all resolver functions
 */

import Resolver from '@forge/resolver';
import { registerAnalyticsResolvers } from './resolvers/analyticsResolvers.js';
import { registerScreenshotResolvers } from './resolvers/screenshotResolvers.js';
import { registerBRDResolvers } from './resolvers/brdResolvers.js';
import { registerWorklogResolvers } from './resolvers/worklogResolvers.js';
import { registerSettingsResolvers } from './resolvers/settingsResolvers.js';
import { registerIssueResolvers } from './resolvers/issueResolvers.js';
import { registerPermissionsResolvers } from './resolvers/permissionsResolvers.js';
import { registerUserResolvers } from './resolvers/userResolvers.js';
import { registerUnassignedWorkResolvers } from './resolvers/unassignedWorkResolvers.js';
import { registerDiagnosticResolvers } from './resolvers/diagnosticResolvers.js';
import { registerFeedbackResolvers } from './resolvers/feedbackResolvers.js';

// Create resolver instance
const resolver = new Resolver();

// Register all resolvers
registerAnalyticsResolvers(resolver);
registerScreenshotResolvers(resolver);
registerBRDResolvers(resolver);
registerWorklogResolvers(resolver);
registerSettingsResolvers(resolver);
registerIssueResolvers(resolver);
registerPermissionsResolvers(resolver);
registerUserResolvers(resolver);
registerUnassignedWorkResolvers(resolver);
registerDiagnosticResolvers(resolver);
registerFeedbackResolvers(resolver);

// Export handler for Forge
export const handler = resolver.getDefinitions();
