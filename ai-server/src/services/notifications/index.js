/**
 * Notifications Module Entry Point
 * 
 * Exports all notification-related services and utilities.
 */

const notifmeWrapper = require('./notifme-wrapper');
const notificationService = require('./notification-service');
const notificationPollingService = require('./notification-polling');
const templates = require('./templates');

module.exports = {
    // Core services
    notifmeWrapper,
    notificationService,
    notificationPollingService,
    
    // Email templates
    templates,
    
    // Convenience re-exports
    sendEmail: (options) => notifmeWrapper.send(options),
    
    // Polling controls
    startPolling: () => notificationPollingService.start(),
    stopPolling: () => notificationPollingService.stop(),
    getPollingStatus: () => notificationPollingService.getStatus(),
    
    // Direct send methods
    sendLoginReminder: (userId, orgId, data) => 
        notificationService.sendLoginReminder(userId, orgId, data),
    sendDownloadReminder: (userId, orgId, platform) => 
        notificationService.sendDownloadReminder(userId, orgId, platform),
    sendNewVersionNotification: (userId, orgId, versionInfo) => 
        notificationService.sendNewVersionNotification(userId, orgId, versionInfo),
    sendInactivityAlert: (userId, orgId, activityData) => 
        notificationService.sendInactivityAlert(userId, orgId, activityData)
};
