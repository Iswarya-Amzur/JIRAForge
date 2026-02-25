/**
 * Email Templates Index
 * 
 * Exports all notification email templates
 */

const loginReminder = require('./login-reminder');
const downloadReminder = require('./download-reminder');
const newVersion = require('./new-version');
const inactivityAlert = require('./inactivity-alert');

module.exports = {
    loginReminder,
    downloadReminder,
    newVersion,
    inactivityAlert,
    
    // Map by type for easy lookup
    byType: {
        'login_reminder': loginReminder,
        'download_reminder': downloadReminder,
        'new_version': newVersion,
        'inactivity_alert': inactivityAlert
    },
    
    // Get template by type
    getTemplate(type) {
        return this.byType[type] || null;
    },
    
    // Get all template types
    getTypes() {
        return Object.keys(this.byType);
    }
};
