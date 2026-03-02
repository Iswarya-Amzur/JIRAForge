/**
 * Notification Polling Service
 * 
 * Runs periodic checks for notification triggers:
 * - Login reminders for inactive users
 * - Download reminders for users without the desktop app
 * - New version notifications for users with outdated versions
 * - Inactivity alerts for users who stopped tracking
 */

const notificationService = require('./notification-service');
const notificationDb = require('../db/notification-db-service');
const { getClient } = require('../db/supabase-client');
const logger = require('../../utils/logger');

// Configuration (can be overridden via environment variables)
const POLLING_INTERVAL = parseInt(process.env.NOTIFICATION_POLLING_INTERVAL || '900000', 10); // 15 minutes
const INACTIVITY_THRESHOLD_HOURS = parseFloat(process.env.INACTIVITY_THRESHOLD_HOURS || '4');
const LOGIN_REMINDER_DAYS = parseInt(process.env.LOGIN_REMINDER_DAYS || '7', 10);

class NotificationPollingService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.lastRunTime = null;
        this.stats = {
            runsCompleted: 0,
            lastErrors: [],
            notificationsSent: {
                login_reminder: 0,
                download_reminder: 0,
                new_version: 0,
                inactivity_alert: 0,
                admin_inactivity_digest: 0,
                admin_download_digest: 0
            }
        };
    }

    /**
     * Start the polling service
     */
    start() {
        if (this.isRunning) {
            logger.warn('[NotificationPolling] Already running');
            return;
        }

        this.isRunning = true;
        logger.info('[NotificationPolling] Starting notification polling service');

        // Run immediately on start
        this.runAllChecks().catch(err => {
            logger.error('[NotificationPolling] Initial run failed: %s', err.message);
        });

        // Set up interval
        this.intervalId = setInterval(() => {
            this.runAllChecks().catch(err => {
                logger.error('[NotificationPolling] Scheduled run failed: %s', err.message);
            });
        }, POLLING_INTERVAL);

        logger.info(`[NotificationPolling] Polling every ${POLLING_INTERVAL / 60000} minutes`);
    }

    /**
     * Stop the polling service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('[NotificationPolling] Stopped');
    }

    /**
     * Get service status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRunTime: this.lastRunTime,
            pollingIntervalMs: POLLING_INTERVAL,
            stats: this.stats
        };
    }

    /**
     * Run all notification checks
     */
    async runAllChecks() {
        const startTime = Date.now();
        logger.info('[NotificationPolling] Running notification checks...');
        
        try {
            // Run all checks in parallel
            await Promise.allSettled([
                this.checkLoginReminders(),
                this.checkDownloadReminders(),
                this.checkNewVersionNotifications(),
                this.checkInactivityAlerts()
            ]);

            this.lastRunTime = new Date().toISOString();
            this.stats.runsCompleted++;
            
            const duration = Date.now() - startTime;
            logger.info(`[NotificationPolling] Notification checks complete in ${duration}ms`);
            
        } catch (error) {
            logger.error('[NotificationPolling] Error running checks: %s', error.message);
            this.stats.lastErrors.push({
                time: new Date().toISOString(),
                error: error.message
            });
            // Keep only last 10 errors
            if (this.stats.lastErrors.length > 10) {
                this.stats.lastErrors.shift();
            }
        }
    }

    /**
     * Check and send login reminders
     * Users who haven't logged in for X days
     */
    async checkLoginReminders() {
        try {
            const supabase = getClient();
            if (!supabase) {
                logger.warn('[NotificationPolling] Supabase not available for login reminders');
                return;
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - LOGIN_REMINDER_DAYS);

            // Find users who:
            // - Are active
            // - Have an email
            // - Are not currently logged into desktop app
            // - Haven't had a heartbeat recently (or never)
            const { data: users, error } = await supabase
                .from('users')
                .select('id, organization_id, email, display_name, desktop_logged_in, desktop_last_heartbeat')
                .eq('is_active', true)
                .eq('desktop_logged_in', false)
                .not('email', 'is', null)
                .or(`desktop_last_heartbeat.is.null,desktop_last_heartbeat.lt.${cutoffDate.toISOString()}`);

            if (error) {
                logger.error('[NotificationPolling] Error querying users for login reminders: %s', error.message);
                return;
            }

            let sentCount = 0;
            for (const user of (users || [])) {
                try {
                    const result = await notificationService.sendLoginReminder(
                        user.id, 
                        user.organization_id,
                        {
                            lastLoginDate: user.desktop_last_heartbeat 
                                ? new Date(user.desktop_last_heartbeat).toLocaleDateString()
                                : null
                        }
                    );
                    if (result.success) sentCount++;
                } catch (err) {
                    logger.warn(`[NotificationPolling] Error sending login reminder to ${user.id}:`, err.message);
                }
            }

            this.stats.notificationsSent.login_reminder += sentCount;
            logger.info(`[NotificationPolling] Login reminders: checked ${users?.length || 0} users, sent ${sentCount}`);
            
        } catch (error) {
            logger.error('[NotificationPolling] Error checking login reminders: %s', error.message);
        }
    }

    /**
     * Check and send download reminders
     * Users who have logged in but never downloaded the desktop app
     */
    async checkDownloadReminders() {
        try {
            const supabase = getClient();
            if (!supabase) {
                logger.warn('[NotificationPolling] Supabase not available for download reminders');
                return;
            }

            // Find users who:
            // - Are active
            // - Have an email
            // - Have an Atlassian account (logged into Jira)
            // - Never had a desktop app version (never downloaded)
            const { data: users, error } = await supabase
                .from('users')
                .select('id, organization_id, email, display_name, desktop_app_version, desktop_last_heartbeat')
                .eq('is_active', true)
                .not('email', 'is', null)
                .not('atlassian_account_id', 'is', null)
                .is('desktop_app_version', null);

            if (error) {
                logger.error('[NotificationPolling] Error querying users for download reminders: %s', error.message);
                return;
            }

            let sentCount = 0;
            for (const user of (users || [])) {
                try {
                    const result = await notificationService.sendDownloadReminder(
                        user.id, 
                        user.organization_id,
                        'Windows' // Default platform
                    );
                    if (result.success) sentCount++;
                } catch (err) {
                    logger.warn(`[NotificationPolling] Error sending download reminder to ${user.id}:`, err.message);
                }
            }

            this.stats.notificationsSent.download_reminder += sentCount;
            logger.info(`[NotificationPolling] Download reminders: checked ${users?.length || 0} users, sent ${sentCount}`);

            // Admin download digest: group no-app users by org, send one digest per org
            const byOrg = {};
            for (const user of (users || [])) {
                if (!byOrg[user.organization_id]) byOrg[user.organization_id] = [];
                byOrg[user.organization_id].push(user);
            }

            let adminSentCount = 0;
            for (const [orgId, orgUsers] of Object.entries(byOrg)) {
                const [admins, orgName] = await Promise.all([
                    this._getOrgAdmins(orgId),
                    this._getOrgName(orgId)
                ]);
                const digestUsers = orgUsers.map(u => ({
                    name: u.display_name || u.email,
                    email: u.email
                }));
                for (const admin of admins) {
                    try {
                        const result = await notificationService.sendAdminDownloadDigest(
                            admin.id, orgId, { orgName, users: digestUsers }
                        );
                        if (result.success) adminSentCount++;
                    } catch (err) {
                        logger.warn(`[NotificationPolling] Error sending admin download digest to ${admin.id}:`, err.message);
                    }
                }
            }
            this.stats.notificationsSent.admin_download_digest += adminSentCount;
            logger.info(`[NotificationPolling] Admin download digests sent: ${adminSentCount}`);

        } catch (error) {
            logger.error('[NotificationPolling] Error checking download reminders: %s', error.message);
        }
    }

    /**
     * Check and send new version notifications
     * Users with outdated desktop app versions
     */
    async checkNewVersionNotifications() {
        try {
            const supabase = getClient();
            if (!supabase) {
                logger.warn('[NotificationPolling] Supabase not available for version notifications');
                return;
            }

            // Get latest version
            const { data: latestRelease, error: releaseError } = await supabase
                .from('app_releases')
                .select('version, download_url, release_notes, is_mandatory')
                .eq('platform', 'windows')
                .eq('is_latest', true)
                .eq('is_active', true)
                .single();

            if (releaseError || !latestRelease) {
                logger.debug('[NotificationPolling] No latest release found for version notifications');
                return;
            }

            // Find users who:
            // - Are active
            // - Have an email
            // - Are logged into desktop app
            // - Have a version different from latest
            const { data: users, error } = await supabase
                .from('users')
                .select('id, organization_id, email, display_name, desktop_app_version')
                .eq('is_active', true)
                .eq('desktop_logged_in', true)
                .not('email', 'is', null)
                .not('desktop_app_version', 'is', null)
                .neq('desktop_app_version', latestRelease.version);

            if (error) {
                logger.error('[NotificationPolling] Error querying users for version notifications: %s', error.message);
                return;
            }

            let sentCount = 0;
            for (const user of (users || [])) {
                try {
                    // Verify version is actually older (not newer)
                    if (this._isVersionOlder(user.desktop_app_version, latestRelease.version)) {
                        const result = await notificationService.sendNewVersionNotification(
                            user.id, 
                            user.organization_id, 
                            {
                                version: latestRelease.version,
                                currentVersion: user.desktop_app_version,
                                releaseNotes: latestRelease.release_notes,
                                downloadUrl: latestRelease.download_url,
                                isMandatory: latestRelease.is_mandatory
                            }
                        );
                        if (result.success) sentCount++;
                    }
                } catch (err) {
                    logger.warn(`[NotificationPolling] Error sending version notification to ${user.id}:`, err.message);
                }
            }

            this.stats.notificationsSent.new_version += sentCount;
            logger.info(`[NotificationPolling] Version notifications: checked ${users?.length || 0} users, sent ${sentCount}`);
            
        } catch (error) {
            logger.error('[NotificationPolling] Error checking version notifications: %s', error.message);
        }
    }

    /**
     * Check and send inactivity alerts
     * Users with desktop app logged in but no activity for INACTIVITY_THRESHOLD_HOURS+.
     * Uses combined signal: MAX(desktop_last_heartbeat, activity_records.batch_end)
     * so users who are actively uploading activity batches are not incorrectly flagged.
     */
    async checkInactivityAlerts() {
        try {
            const supabase = getClient();
            if (!supabase) {
                logger.warn('[NotificationPolling] Supabase not available for inactivity alerts');
                return;
            }

            const thresholdTime = new Date();
            thresholdTime.setHours(thresholdTime.getHours() - INACTIVITY_THRESHOLD_HOURS);

            // Query 1: all logged-in users (no heartbeat filter — we filter below after
            // combining with activity_records.batch_end)
            const { data: users, error } = await supabase
                .from('users')
                .select('id, organization_id, email, display_name, desktop_last_heartbeat')
                .eq('is_active', true)
                .eq('desktop_logged_in', true)
                .not('email', 'is', null)
                .not('desktop_last_heartbeat', 'is', null);

            if (error) {
                logger.error('[NotificationPolling] Error querying users for inactivity alerts: %s', error.message);
                return;
            }

            if (!users?.length) {
                logger.info('[NotificationPolling] Inactivity alerts: no logged-in users found');
                return;
            }

            // Query 2: any activity_records with batch_end newer than threshold (one bulk
            // query for all users — avoids N+1 per-user queries)
            const userIds = users.map(u => u.id);
            const { data: recentActivity } = await supabase
                .from('activity_records')
                .select('user_id, batch_end')
                .in('user_id', userIds)
                .gt('batch_end', thresholdTime.toISOString());

            // Set of users who have uploaded at least one recent activity batch
            const usersWithRecentActivity = new Set((recentActivity || []).map(r => r.user_id));

            // Map: user_id → latest batch_end timestamp string (for hoursInactive calc)
            const latestBatchByUser = {};
            for (const r of (recentActivity || [])) {
                if (!latestBatchByUser[r.user_id] || r.batch_end > latestBatchByUser[r.user_id]) {
                    latestBatchByUser[r.user_id] = r.batch_end;
                }
            }

            // Only alert users where BOTH the heartbeat AND activity_records are stale
            const inactiveUsers = users.filter(user => {
                const heartbeatOld = new Date(user.desktop_last_heartbeat) < thresholdTime;
                const hasRecentActivity = usersWithRecentActivity.has(user.id);
                return heartbeatOld && !hasRecentActivity;
            });

            let sentCount = 0;
            for (const user of inactiveUsers) {
                try {
                    const isWorkHours = await this._isWithinWorkHours(user.id);
                    if (!isWorkHours) {
                        continue;
                    }

                    // effective last active = MAX(heartbeat, latest batch_end)
                    const heartbeatTime = new Date(user.desktop_last_heartbeat);
                    const batchTime = latestBatchByUser[user.id]
                        ? new Date(latestBatchByUser[user.id])
                        : null;
                    const effectiveLastActive = batchTime && batchTime > heartbeatTime
                        ? batchTime
                        : heartbeatTime;

                    const hoursInactive = Math.round(
                        (Date.now() - effectiveLastActive.getTime()) / (1000 * 60 * 60) * 10
                    ) / 10;

                    const result = await notificationService.sendInactivityAlert(
                        user.id,
                        user.organization_id,
                        {
                            lastActivityTime: effectiveLastActive.toLocaleString(),
                            hoursInactive
                        }
                    );
                    if (result.success) sentCount++;
                } catch (err) {
                    logger.warn(`[NotificationPolling] Error sending inactivity alert to ${user.id}:`, err.message);
                }
            }

            this.stats.notificationsSent.inactivity_alert += sentCount;
            logger.info(`[NotificationPolling] Inactivity alerts: checked ${users.length} users, ${inactiveUsers.length} inactive, sent ${sentCount}`);

            // Admin inactivity digest: group inactive users by org, send one digest per org
            const byOrg = {};
            for (const user of inactiveUsers) {
                if (!byOrg[user.organization_id]) byOrg[user.organization_id] = [];
                byOrg[user.organization_id].push(user);
            }

            let adminSentCount = 0;
            for (const [orgId, orgInactiveUsers] of Object.entries(byOrg)) {
                const [admins, orgName] = await Promise.all([
                    this._getOrgAdmins(orgId),
                    this._getOrgName(orgId)
                ]);
                const digestUsers = orgInactiveUsers.map(user => {
                    const heartbeatTime = new Date(user.desktop_last_heartbeat);
                    const batchTime = latestBatchByUser[user.id] ? new Date(latestBatchByUser[user.id]) : null;
                    const effectiveLastActive = batchTime && batchTime > heartbeatTime ? batchTime : heartbeatTime;
                    const hoursInactive = Math.round(
                        (Date.now() - effectiveLastActive.getTime()) / (1000 * 60 * 60) * 10
                    ) / 10;
                    return {
                        name: user.display_name || user.email,
                        hoursInactive,
                        lastActivity: effectiveLastActive.toLocaleString()
                    };
                });
                for (const admin of admins) {
                    try {
                        const result = await notificationService.sendAdminInactivityDigest(
                            admin.id, orgId, { orgName, inactiveUsers: digestUsers }
                        );
                        if (result.success) adminSentCount++;
                    } catch (err) {
                        logger.warn(`[NotificationPolling] Error sending admin inactivity digest to ${admin.id}:`, err.message);
                    }
                }
            }
            this.stats.notificationsSent.admin_inactivity_digest += adminSentCount;
            logger.info(`[NotificationPolling] Admin inactivity digests sent: ${adminSentCount}`);

        } catch (error) {
            logger.error('[NotificationPolling] Error checking inactivity alerts: %s', error.message);
        }
    }

    /**
     * Get all owner/admin users for an organization
     * @param {string} orgId - Organization ID
     * @returns {Promise<Array>} Array of {id, email, display_name}
     */
    async _getOrgAdmins(orgId) {
        try {
            const supabase = getClient();
            if (!supabase) return [];
            // Use project_settings.configured_by — the user who configured each project
            // must have ADMINISTER_PROJECTS permission in Jira, making them the true
            // project admin (not just an org-level admin who may be a regular employee).
            const { data, error } = await supabase
                .from('project_settings')
                .select('users!configured_by(id, email, display_name)')
                .eq('organization_id', orgId)
                .not('configured_by', 'is', null);
            if (error || !data) return [];
            // Deduplicate — same person may have configured multiple projects
            const seen = new Set();
            return data
                .map(r => r.users)
                .filter(u => u && u.email && !seen.has(u.id) && seen.add(u.id));
        } catch (err) {
            logger.warn('[NotificationPolling] Error fetching project admins:', err.message);
            return [];
        }
    }

    /**
     * Get the display name of an organization
     * @param {string} orgId - Organization ID
     * @returns {Promise<string>} Organization name
     */
    async _getOrgName(orgId) {
        try {
            const supabase = getClient();
            if (!supabase) return 'Your Organization';
            const { data } = await supabase
                .from('organizations')
                .select('org_name')
                .eq('id', orgId)
                .single();
            return data?.org_name || 'Your Organization';
        } catch (err) {
            return 'Your Organization';
        }
    }

    /**
     * Compare semantic versions
     * @param {string} v1 - First version
     * @param {string} v2 - Second version
     * @returns {boolean} True if v1 is older than v2
     */
    _isVersionOlder(v1, v2) {
        if (!v1 || !v2) return false;
        
        const parse = (v) => v.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
        const parts1 = parse(v1);
        const parts2 = parse(v2);

        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 < p2) return true;
            if (p1 > p2) return false;
        }
        return false;
    }

    /**
     * Check if current time is within user's configured work hours
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} True if within work hours
     */
    async _isWithinWorkHours(userId) {
        try {
            const prefs = await notificationDb.getUserPreferences(userId);
            
            // Default to allowing if no preferences set
            if (!prefs) return true;

            const now = new Date();
            const userTimezone = prefs.timezone || 'UTC';
            
            // Convert to user's timezone
            let userTime;
            try {
                userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
            } catch {
                // Invalid timezone, use UTC
                userTime = now;
            }
            
            const currentHour = userTime.getHours();
            const currentMinute = userTime.getMinutes();
            const currentDay = userTime.getDay() || 7; // Convert Sunday from 0 to 7

            // Check if it's a work day (default: Monday-Friday)
            const workDays = prefs.work_days || [1, 2, 3, 4, 5];
            if (!workDays.includes(currentDay)) {
                return false;
            }

            // Parse work hours (format: "HH:MM:SS")
            const parseTime = (timeStr) => {
                const [h, m] = (timeStr || '09:00:00').split(':').map(Number);
                return h * 60 + (m || 0);
            };

            const startMinutes = parseTime(prefs.work_hours_start);
            const endMinutes = parseTime(prefs.work_hours_end);
            const currentMinutes = currentHour * 60 + currentMinute;

            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
            
        } catch (error) {
            logger.warn('[NotificationPolling] Error checking work hours:', error.message);
            // Default to allowing on error
            return true;
        }
    }

    /**
     * Run a single check type manually
     * @param {string} checkType - Type of check to run
     * @returns {Promise<void>}
     */
    async runSingleCheck(checkType) {
        const checks = {
            'login_reminder': () => this.checkLoginReminders(),
            'download_reminder': () => this.checkDownloadReminders(),
            'new_version': () => this.checkNewVersionNotifications(),
            'inactivity_alert': () => this.checkInactivityAlerts()
        };

        const checkFn = checks[checkType];
        if (!checkFn) {
            throw new Error(`Unknown check type: ${checkType}`);
        }

        await checkFn();
    }
}

// Export singleton instance
const notificationPollingService = new NotificationPollingService();
module.exports = notificationPollingService;

// Also export class for testing
module.exports.NotificationPollingService = NotificationPollingService;
