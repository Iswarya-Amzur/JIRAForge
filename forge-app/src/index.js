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

// Create resolver instance
const resolver = new Resolver();

// Register all resolvers
registerAnalyticsResolvers(resolver);
registerScreenshotResolvers(resolver);
registerBRDResolvers(resolver);
registerWorklogResolvers(resolver);
registerSettingsResolvers(resolver);
registerIssueResolvers(resolver);

// Export handler for Forge
export const handler = resolver.getDefinitions();
