/**
 * Quick script to verify OAuth configuration
 * Run with: node verify-oauth-config.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('=== OAuth Configuration Verification ===\n');

const clientId = process.env.ATLASSIAN_CLIENT_ID;
const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

console.log('1. Client ID Check:');
if (!clientId) {
  console.error('   ❌ Client ID is NOT SET');
} else {
  console.log('   ✅ Client ID is set');
  console.log('   Length:', clientId.length, 'characters');
  console.log('   Value:', clientId);
  console.log('   First 10 chars:', clientId.substring(0, 10));
  console.log('   Last 10 chars:', clientId.substring(clientId.length - 10));
  
  // Check for common typos
  if (clientId.includes('0880WNDrOqwwM5')) {
    console.error('   ⚠️  WARNING: Possible typo detected! Should be "088oWNDrOqwvM5" not "0880WNDrOqwwM5"');
  }
}

console.log('\n2. Client Secret Check:');
if (!clientSecret) {
  console.error('   ❌ Client Secret is NOT SET');
} else {
  console.log('   ✅ Client Secret is set');
  console.log('   Length:', clientSecret.length, 'characters');
  console.log('   First 10 chars:', clientSecret.substring(0, 10));
}

console.log('\n3. Expected Values:');
console.log('   Client ID should be: Q8HT4Jn205AuTiAarj088oWNDrOqwvM5');
console.log('   Length: 32 characters');
console.log('   Your Client ID:', clientId === 'Q8HT4Jn205AuTiAarj088oWNDrOqwvM5' ? '✅ MATCHES' : '❌ DOES NOT MATCH');

console.log('\n4. Redirect URI:');
console.log('   Should be: brd-time-tracker://oauth/callback');
console.log('   (This is hardcoded in auth-manager.js)');

console.log('\n5. Next Steps:');
if (!clientId || !clientSecret) {
  console.error('   ❌ Please set ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET in .env file');
} else if (clientId !== 'Q8HT4Jn205AuTiAarj088oWNDrOqwvM5') {
  console.warn('   ⚠️  Client ID does not match expected value. Please verify in Atlassian Console.');
  console.warn('   Go to: https://developer.atlassian.com/console/myapps/');
  console.warn('   Open your app → Settings tab → Copy Client ID');
} else {
  console.log('   ✅ Configuration looks good!');
  console.log('   Make sure in Atlassian Console:');
  console.log('   - Authorization tab → Callback URL: brd-time-tracker://oauth/callback');
  console.log('   - Permissions tab → All required scopes are added');
}

console.log('\n=== End Verification ===\n');

