/**
 * Notification Polling Service Unit Tests
 */

// Mock dependencies before requiring the module
jest.mock('../../src/services/notifications/notification-service', () => ({
    sendLoginReminder: jest.fn(),
    sendDownloadReminder: jest.fn(),
    sendNewVersionNotification: jest.fn(),
    sendInactivityAlert: jest.fn()
}));

jest.mock('../../src/services/db/notification-db-service', () => ({
    getUserPreferences: jest.fn()
}));

jest.mock('../../src/services/db/supabase-client', () => ({
    getClient: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

const { NotificationPollingService } = require('../../src/services/notifications/notification-polling');
const notificationService = require('../../src/services/notifications/notification-service');
const notificationDb = require('../../src/services/db/notification-db-service');
const { getClient } = require('../../src/services/db/supabase-client');

describe('NotificationPollingService', () => {
    let pollingService;
    let mockSupabase;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        
        pollingService = new NotificationPollingService();
        
        // Mock Supabase client
        mockSupabase = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            lt: jest.fn().mockReturnThis(),
            or: jest.fn().mockReturnThis(),
            single: jest.fn()
        };
        getClient.mockReturnValue(mockSupabase);

        // Default mock responses
        notificationService.sendLoginReminder.mockResolvedValue({ success: true });
        notificationService.sendDownloadReminder.mockResolvedValue({ success: true });
        notificationService.sendNewVersionNotification.mockResolvedValue({ success: true });
        notificationService.sendInactivityAlert.mockResolvedValue({ success: true });
        notificationDb.getUserPreferences.mockResolvedValue({
            work_hours_start: '09:00:00',
            work_hours_end: '18:00:00',
            work_days: [1, 2, 3, 4, 5],
            timezone: 'UTC'
        });
    });

    afterEach(() => {
        pollingService.stop();
        jest.useRealTimers();
    });

    describe('start/stop', () => {
        it('should start polling service', () => {
            pollingService.start();
            expect(pollingService.isRunning).toBe(true);
        });

        it('should not start if already running', () => {
            pollingService.start();
            pollingService.start();
            // Should only have one interval
            expect(pollingService.isRunning).toBe(true);
        });

        it('should stop polling service', () => {
            pollingService.start();
            pollingService.stop();
            expect(pollingService.isRunning).toBe(false);
        });

        it('should handle stop when not running', () => {
            pollingService.stop();
            expect(pollingService.isRunning).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return status when not running', () => {
            const status = pollingService.getStatus();
            expect(status.isRunning).toBe(false);
            expect(status.lastRunTime).toBeNull();
        });

        it('should return status with last run time after running', async () => {
            mockSupabase.select.mockResolvedValue({ data: [], error: null });
            
            await pollingService.runAllChecks();
            
            const status = pollingService.getStatus();
            expect(status.lastRunTime).toBeDefined();
            expect(status.stats.runsCompleted).toBe(1);
        });
    });

    describe('checkLoginReminders', () => {
        it('should find and notify users who need login reminders', async () => {
            const mockUsers = [
                { id: 'user-1', organization_id: 'org-1', email: 'user1@test.com', desktop_last_heartbeat: null },
                { id: 'user-2', organization_id: 'org-1', email: 'user2@test.com', desktop_last_heartbeat: '2025-01-01' }
            ];
            
            mockSupabase.or.mockResolvedValue({ data: mockUsers, error: null });

            await pollingService.checkLoginReminders();

            expect(notificationService.sendLoginReminder).toHaveBeenCalledTimes(2);
        });

        it('should handle empty user list', async () => {
            mockSupabase.or.mockResolvedValue({ data: [], error: null });

            await pollingService.checkLoginReminders();

            expect(notificationService.sendLoginReminder).not.toHaveBeenCalled();
        });

        it('should handle database errors', async () => {
            mockSupabase.or.mockResolvedValue({ data: null, error: new Error('DB error') });

            await pollingService.checkLoginReminders();

            // Should not throw, just log error
            expect(notificationService.sendLoginReminder).not.toHaveBeenCalled();
        });

        it('should handle missing supabase client', async () => {
            getClient.mockReturnValue(null);

            await pollingService.checkLoginReminders();

            expect(notificationService.sendLoginReminder).not.toHaveBeenCalled();
        });

        it('should continue on individual send failures', async () => {
            const mockUsers = [
                { id: 'user-1', organization_id: 'org-1', email: 'user1@test.com' },
                { id: 'user-2', organization_id: 'org-1', email: 'user2@test.com' }
            ];
            
            mockSupabase.or.mockResolvedValue({ data: mockUsers, error: null });
            notificationService.sendLoginReminder
                .mockRejectedValueOnce(new Error('Send failed'))
                .mockResolvedValueOnce({ success: true });

            await pollingService.checkLoginReminders();

            expect(notificationService.sendLoginReminder).toHaveBeenCalledTimes(2);
        });
    });

    describe('checkDownloadReminders', () => {
        it('should find and notify users without desktop app', async () => {
            const mockUsers = [
                { id: 'user-1', organization_id: 'org-1', email: 'user1@test.com', desktop_app_version: null }
            ];
            
            mockSupabase.is.mockResolvedValue({ data: mockUsers, error: null });

            await pollingService.checkDownloadReminders();

            expect(notificationService.sendDownloadReminder).toHaveBeenCalledWith(
                'user-1',
                'org-1',
                'Windows'
            );
        });
    });

    describe('checkNewVersionNotifications', () => {
        it('should find users with outdated versions', async () => {
            const latestRelease = {
                version: '2.0.0',
                download_url: 'https://example.com/download',
                release_notes: 'New features',
                is_mandatory: false
            };
            
            const mockUsers = [
                { id: 'user-1', organization_id: 'org-1', email: 'user1@test.com', desktop_app_version: '1.0.0' }
            ];

            mockSupabase.single.mockResolvedValue({ data: latestRelease, error: null });
            mockSupabase.neq.mockResolvedValue({ data: mockUsers, error: null });

            await pollingService.checkNewVersionNotifications();

            expect(notificationService.sendNewVersionNotification).toHaveBeenCalled();
        });

        it('should skip if no latest release found', async () => {
            mockSupabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

            await pollingService.checkNewVersionNotifications();

            expect(notificationService.sendNewVersionNotification).not.toHaveBeenCalled();
        });

        it('should not notify users with newer versions', async () => {
            const latestRelease = { version: '2.0.0' };
            const mockUsers = [
                { id: 'user-1', organization_id: 'org-1', email: 'user1@test.com', desktop_app_version: '3.0.0' }
            ];

            mockSupabase.single.mockResolvedValue({ data: latestRelease, error: null });
            mockSupabase.neq.mockResolvedValue({ data: mockUsers, error: null });

            await pollingService.checkNewVersionNotifications();

            // Should not send because 3.0.0 is not older than 2.0.0
            expect(notificationService.sendNewVersionNotification).not.toHaveBeenCalled();
        });
    });

    describe('checkInactivityAlerts', () => {
        beforeEach(() => {
            // Mock current time to be within work hours
            jest.setSystemTime(new Date('2025-02-25T14:00:00Z')); // Tuesday 2pm UTC
        });

        it('should find and alert inactive users', async () => {
            const oldTime = new Date('2025-02-25T09:00:00Z').toISOString();
            const mockUsers = [
                { id: 'user-1', organization_id: 'org-1', email: 'user1@test.com', desktop_last_heartbeat: oldTime }
            ];
            
            mockSupabase.lt.mockResolvedValue({ data: mockUsers, error: null });

            await pollingService.checkInactivityAlerts();

            expect(notificationService.sendInactivityAlert).toHaveBeenCalled();
        });

        it('should skip users outside work hours', async () => {
            const oldTime = new Date('2025-02-25T09:00:00Z').toISOString();
            const mockUsers = [
                { id: 'user-1', organization_id: 'org-1', email: 'user1@test.com', desktop_last_heartbeat: oldTime }
            ];
            
            mockSupabase.lt.mockResolvedValue({ data: mockUsers, error: null });
            
            // Mock preferences with opposite work hours
            notificationDb.getUserPreferences.mockResolvedValue({
                work_hours_start: '20:00:00',
                work_hours_end: '23:00:00',
                work_days: [1, 2, 3, 4, 5],
                timezone: 'UTC'
            });

            await pollingService.checkInactivityAlerts();

            expect(notificationService.sendInactivityAlert).not.toHaveBeenCalled();
        });

        it('should skip users on non-work days', async () => {
            // Set to Sunday
            jest.setSystemTime(new Date('2025-02-23T14:00:00Z'));
            
            const oldTime = new Date('2025-02-23T09:00:00Z').toISOString();
            const mockUsers = [
                { id: 'user-1', organization_id: 'org-1', email: 'user1@test.com', desktop_last_heartbeat: oldTime }
            ];
            
            mockSupabase.lt.mockResolvedValue({ data: mockUsers, error: null });

            await pollingService.checkInactivityAlerts();

            expect(notificationService.sendInactivityAlert).not.toHaveBeenCalled();
        });
    });

    describe('_isVersionOlder', () => {
        it('should correctly compare versions', () => {
            expect(pollingService._isVersionOlder('1.0.0', '2.0.0')).toBe(true);
            expect(pollingService._isVersionOlder('2.0.0', '1.0.0')).toBe(false);
            expect(pollingService._isVersionOlder('1.5.0', '1.5.0')).toBe(false);
            expect(pollingService._isVersionOlder('1.0.0', '1.0.1')).toBe(true);
            expect(pollingService._isVersionOlder('1.9.9', '1.10.0')).toBe(true);
        });

        it('should handle versions with prefixes', () => {
            expect(pollingService._isVersionOlder('v1.0.0', 'v2.0.0')).toBe(true);
        });

        it('should handle null/undefined versions', () => {
            expect(pollingService._isVersionOlder(null, '2.0.0')).toBe(false);
            expect(pollingService._isVersionOlder('1.0.0', null)).toBe(false);
            expect(pollingService._isVersionOlder(null, null)).toBe(false);
        });

        it('should handle versions with different part counts', () => {
            expect(pollingService._isVersionOlder('1.0', '1.0.1')).toBe(true);
            expect(pollingService._isVersionOlder('1.0.0', '1.1')).toBe(true);
        });
    });

    describe('_isWithinWorkHours', () => {
        beforeEach(() => {
            jest.setSystemTime(new Date('2025-02-25T14:00:00Z')); // Tuesday 2pm UTC
        });

        it('should return true when within work hours', async () => {
            notificationDb.getUserPreferences.mockResolvedValue({
                work_hours_start: '09:00:00',
                work_hours_end: '18:00:00',
                work_days: [1, 2, 3, 4, 5],
                timezone: 'UTC'
            });

            const result = await pollingService._isWithinWorkHours('user-1');
            expect(result).toBe(true);
        });

        it('should return false when outside work hours', async () => {
            notificationDb.getUserPreferences.mockResolvedValue({
                work_hours_start: '09:00:00',
                work_hours_end: '12:00:00',
                work_days: [1, 2, 3, 4, 5],
                timezone: 'UTC'
            });

            const result = await pollingService._isWithinWorkHours('user-1');
            expect(result).toBe(false);
        });

        it('should return true with default preferences', async () => {
            notificationDb.getUserPreferences.mockResolvedValue(null);

            const result = await pollingService._isWithinWorkHours('user-1');
            expect(result).toBe(true);
        });

        it('should handle different timezones', async () => {
            notificationDb.getUserPreferences.mockResolvedValue({
                work_hours_start: '09:00:00',
                work_hours_end: '18:00:00',
                work_days: [1, 2, 3, 4, 5],
                timezone: 'America/New_York' // UTC-5, so 14:00 UTC = 09:00 EST
            });

            const result = await pollingService._isWithinWorkHours('user-1');
            expect(result).toBe(true);
        });

        it('should return true on errors', async () => {
            notificationDb.getUserPreferences.mockRejectedValue(new Error('DB error'));

            const result = await pollingService._isWithinWorkHours('user-1');
            expect(result).toBe(true);
        });
    });

    describe('runSingleCheck', () => {
        it('should run login reminder check', async () => {
            mockSupabase.or.mockResolvedValue({ data: [], error: null });

            await pollingService.runSingleCheck('login_reminder');

            expect(mockSupabase.from).toHaveBeenCalledWith('users');
        });

        it('should throw for unknown check type', async () => {
            await expect(
                pollingService.runSingleCheck('unknown_type')
            ).rejects.toThrow('Unknown check type');
        });
    });

    describe('runAllChecks', () => {
        it('should run all checks in parallel', async () => {
            mockSupabase.or.mockResolvedValue({ data: [], error: null });
            mockSupabase.is.mockResolvedValue({ data: [], error: null });
            mockSupabase.single.mockResolvedValue({ data: null, error: null });
            mockSupabase.lt.mockResolvedValue({ data: [], error: null });

            await pollingService.runAllChecks();

            expect(pollingService.stats.runsCompleted).toBe(1);
        });

        it('should track errors', async () => {
            // Force an error in one check
            const originalCheckLogin = pollingService.checkLoginReminders;
            pollingService.checkLoginReminders = jest.fn().mockRejectedValue(new Error('Test error'));
            mockSupabase.is.mockResolvedValue({ data: [], error: null });
            mockSupabase.single.mockResolvedValue({ data: null, error: null });
            mockSupabase.lt.mockResolvedValue({ data: [], error: null });

            await pollingService.runAllChecks();

            // Restore original
            pollingService.checkLoginReminders = originalCheckLogin;
        });
    });
});
