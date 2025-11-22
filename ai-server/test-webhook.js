// Test script to verify webhook connectivity
const axios = require('axios');
const https = require('https');

const TUNNEL_URL = 'https://untheistically-unswabbed-kaelyn.ngrok-free.dev';
const API_KEY = 'dev-api-key';

// Create an https agent that ignores SSL certificate errors (for ngrok testing)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function testWebhook() {
    console.log('Testing webhook endpoint...\n');

    // Simulate a Supabase webhook payload
    const testPayload = {
        type: 'INSERT',
        table: 'screenshots',
        record: {
            id: 'test-screenshot-id',
            user_id: 'test-user-id',
            storage_path: 'test-user/screenshot_test.png',
            storage_url: 'https://example.com/test.png',
            window_title: 'Test Window',
            application_name: 'Test.exe',
            timestamp: new Date().toISOString(),
            status: 'pending'
        },
        old_record: null
    };

    try {
        console.log('Sending request to:', `${TUNNEL_URL}/api/analyze-screenshot`);
        console.log('Payload:', JSON.stringify(testPayload, null, 2));

        const response = await axios.post(
            `${TUNNEL_URL}/api/analyze-screenshot`,
            testPayload,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: httpsAgent
            }
        );

        console.log('\n✅ SUCCESS!');
        console.log('Response:', response.data);
    } catch (error) {
        console.log('\n❌ ERROR!');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testWebhook();
