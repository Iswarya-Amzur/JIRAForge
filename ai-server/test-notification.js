/**
 * Quick Test Script for Notification Service
 * 
 * Usage:
 * 1. Update TEST_EMAIL below with a real email from your database
 * 2. Run: node test-notification.js
 * 
 * The script will automatically look up the user by email and get their
 * user_id and organization_id from the database.
 */

require('dotenv').config();
const notificationService = require('./src/services/notifications/notification-service');
const { getClient } = require('./src/services/db/supabase-client');

// ============================================================================
// CONFIGURE THIS VALUE
// ============================================================================
const TEST_EMAIL = 'iswarya.kolimalla@amzur.com';    // Replace with real user email from database

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserByEmail(email) {
    const supabase = getClient();
    if (!supabase) {
        throw new Error('Supabase client not available. Check your .env configuration.');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('id, email, organization_id, display_name, desktop_logged_in, desktop_app_version')
        .eq('email', email)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            throw new Error(`No user found with email: ${email}`);
        }
        throw error;
    }

    return user;
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testLoginReminder(userId, orgId) {
    console.log('\n=== Testing Login Reminder ===');
    try {
        const result = await notificationService.sendLoginReminder(
            userId,
            orgId,
            { lastLoginDate: '2025-01-15' }
        );
        console.log('✅ Result:', result);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testDownloadReminder(userId, orgId) {
    console.log('\n=== Testing Download Reminder ===');
    try {
        const result = await notificationService.sendDownloadReminder(
            userId,
            orgId,
            'Windows'
        );
        console.log('✅ Result:', result);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testNewVersionNotification(userId, orgId) {
    console.log('\n=== Testing New Version Notification ===');
    try {
        const result = await notificationService.sendNewVersionNotification(
            userId,
            orgId,
            {
                version: '2.0.0',
                currentVersion: '1.5.0',
                releaseNotes: 'Bug fixes and performance improvements',
                downloadUrl: 'https://example.com/download',
                isMandatory: false
            }
        );
        console.log('✅ Result:', result);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testInactivityAlert(userId, orgId) {
    console.log('\n=== Testing Inactivity Alert ===');
    try {
        const result = await notificationService.sendInactivityAlert(
            userId,
            orgId,
            {
                lastActivityTime: new Date(Date.now() - 5 * 60 * 60 * 1000).toLocaleString(),
                hoursInactive: 5.0
            }
        );
        console.log('✅ Result:', result);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// ============================================================================
// RUN TESTS
// ============================================================================

async function runAllTests() {
    console.log('🧪 Starting Notification Tests...\n');
    
    if (!TEST_EMAIL || TEST_EMAIL === 'your-test-email@example.com') {
        console.error('❌ ERROR: Please update TEST_EMAIL with a real user email from your database');
        console.error('   Example: const TEST_EMAIL = "user@example.com";');
        process.exit(1);
    }

    console.log('Looking up user by email:', TEST_EMAIL);
    
    let user;
    try {
        user = await getUserByEmail(TEST_EMAIL);
    } catch (error) {
        console.error('❌ Failed to find user:', error.message);
        console.error('\nTips:');
        console.error('  1. Make sure the email exists in your database');
        console.error('  2. Check your Supabase configuration in .env');
        console.error('  3. Run this query to see available users:');
        console.error('     SELECT id, email, organization_id FROM users LIMIT 10;');
        process.exit(1);
    }

    console.log('\n✅ Found user:');
    console.log('  User ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Organization ID:', user.organization_id);
    console.log('  Display Name:', user.display_name || '(not set)');
    console.log('  Desktop Logged In:', user.desktop_logged_in);
    console.log('  Desktop App Version:', user.desktop_app_version || '(not installed)');
    console.log('  Email Provider:', process.env.EMAIL_PROVIDER || process.env.EMAIL_PROVIDERS || '(not configured)');

    // Run each test with the looked-up user info
    await testLoginReminder(user.id, user.organization_id);
    await testDownloadReminder(user.id, user.organization_id);
    await testNewVersionNotification(user.id, user.organization_id);
    await testInactivityAlert(user.id, user.organization_id);
    
    console.log('\n✅ All tests completed!\n');
    console.log('📧 Check your inbox at:', user.email);
    console.log('📊 Check database:');
    console.log('   SELECT notification_type, status, subject, sent_at');
    console.log('   FROM notification_logs');
    console.log('   WHERE user_id = \'' + user.id + '\'');
    console.log('   ORDER BY created_at DESC;');
    
    process.exit(0);
}

// Run tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
