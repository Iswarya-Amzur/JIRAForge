/**
 * Download Reminder Email Template
 * 
 * Sent to users who have logged in but haven't downloaded the desktop app.
 */

module.exports = {
    type: 'download_reminder',
    
    subject: 'Complete Your Setup: Download the JIRAForge Desktop App',
    
    /**
     * Generate plain text email body
     * @param {Object} data - Template data
     * @param {string} data.displayName - User's display name
     * @param {string} data.downloadUrl - URL to download the app
     * @param {string} [data.platform] - Platform name (Windows, macOS, Linux)
     * @returns {string} Plain text email body
     */
    text: ({ displayName, downloadUrl, platform = 'Windows' }) => `
Hi ${displayName},

Complete your JIRAForge setup by downloading the Desktop App!

The Desktop App provides:
✓ Automatic time tracking while you work
✓ Screenshot-based activity monitoring
✓ Seamless Jira worklog synchronization
✓ Offline support - track time even without internet

Download for ${platform}: ${downloadUrl}

Installation is quick and easy - just download, install, and login with your Atlassian account.

Need help? Check out our setup guide or contact support.

Best regards,
The JIRAForge Team

---
You're receiving this email because you signed up for JIRAForge.
To stop receiving these reminders, update your notification settings.
    `.trim(),
    
    /**
     * Generate HTML email body
     * @param {Object} data - Template data
     * @returns {string} HTML email body
     */
    html: ({ displayName, downloadUrl, platform = 'Windows' }) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Download Desktop App</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo h1 {
            color: #0052CC;
            margin: 0;
            font-size: 24px;
        }
        h2 {
            color: #333;
            margin-top: 0;
        }
        .button {
            display: inline-block;
            padding: 14px 28px;
            background: #00875A;
            color: white !important;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 20px 0;
        }
        .button:hover {
            background: #006644;
        }
        .features {
            background: #E3FCEF;
            border: 1px solid #ABF5D1;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .features ul {
            margin: 0;
            padding-left: 0;
            list-style: none;
        }
        .features li {
            margin: 10px 0;
            padding-left: 28px;
            position: relative;
        }
        .features li::before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #00875A;
            font-weight: bold;
        }
        .steps {
            background: #F4F5F7;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .steps ol {
            margin: 0;
            padding-left: 20px;
        }
        .steps li {
            margin: 8px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
            text-align: center;
        }
        .platform-badge {
            display: inline-block;
            background: #0052CC;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="logo">
                <h1>🚀 JIRAForge</h1>
            </div>
            
            <h2>Hi ${displayName},</h2>
            
            <p>Complete your JIRAForge setup by downloading the Desktop App!</p>
            
            <div class="features">
                <strong>The Desktop App provides:</strong>
                <ul>
                    <li>Automatic time tracking while you work</li>
                    <li>Screenshot-based activity monitoring</li>
                    <li>Seamless Jira worklog synchronization</li>
                    <li>Offline support - track time even without internet</li>
                </ul>
            </div>
            
            <p style="text-align: center;">
                <a href="${downloadUrl}" class="button">
                    ⬇️ Download for ${platform}
                </a>
            </p>
            
            <div class="steps">
                <strong>Quick Setup (2 minutes):</strong>
                <ol>
                    <li>Download the installer</li>
                    <li>Run the installer</li>
                    <li>Login with your Atlassian account</li>
                    <li>Start tracking!</li>
                </ol>
            </div>
            
            <p>Need help? Check out our <a href="${downloadUrl}/guide">setup guide</a> or contact support.</p>
            
            <p>Best regards,<br><strong>The JIRAForge Team</strong></p>
            
            <div class="footer">
                <p>You're receiving this email because you signed up for JIRAForge.</p>
                <p>To stop receiving these reminders, update your notification settings.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim()
};
