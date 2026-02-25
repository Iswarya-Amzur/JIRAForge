/**
 * Inactivity Alert Email Template
 * 
 * Sent to users who haven't been active for a specified period during work hours.
 */

module.exports = {
    type: 'inactivity_alert',
    
    subject: '⏰ Are you taking a break? - JIRAForge',
    
    /**
     * Generate plain text email body
     * @param {Object} data - Template data
     * @param {string} data.displayName - User's display name
     * @param {string} data.lastActivityTime - Last activity timestamp
     * @param {number} data.hoursInactive - Hours since last activity
     * @param {string} [data.settingsUrl] - URL to notification settings
     * @returns {string} Plain text email body
     */
    text: ({ displayName, lastActivityTime, hoursInactive, settingsUrl }) => `
Hi ${displayName},

We noticed you haven't been active in JIRAForge for ${hoursInactive} hours.

Last activity: ${lastActivityTime}

If you're taking a well-deserved break, that's great! This is just a friendly reminder.

If you intended to track your work, please open the Desktop App to continue. Your time tracking will automatically resume when you start working again.

Quick tips:
- The Desktop App tracks your activity automatically when running
- You can pause tracking from the system tray icon
- Idle time is automatically detected and excluded

${settingsUrl ? `To adjust or disable these alerts: ${settingsUrl}` : ''}

Best regards,
The JIRAForge Team

---
You're receiving this email because you have inactivity alerts enabled.
To stop receiving these alerts, update your notification settings.
    `.trim(),
    
    /**
     * Generate HTML email body
     * @param {Object} data - Template data
     * @returns {string} HTML email body
     */
    html: ({ displayName, lastActivityTime, hoursInactive, settingsUrl }) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inactivity Alert</title>
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
        .alert-box {
            background: #FFF7E6;
            border: 1px solid #FFE7BA;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
            text-align: center;
        }
        .alert-box .time {
            font-size: 36px;
            font-weight: bold;
            color: #D46B08;
            margin-bottom: 5px;
        }
        .alert-box .label {
            color: #AD6800;
            font-size: 14px;
        }
        .last-activity {
            background: #F4F5F7;
            padding: 12px 16px;
            border-radius: 4px;
            margin: 15px 0;
            font-size: 14px;
            text-align: center;
        }
        .tips {
            background: #E3FCEF;
            border: 1px solid #ABF5D1;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .tips h4 {
            margin-top: 0;
            color: #006644;
        }
        .tips ul {
            margin: 0;
            padding-left: 20px;
        }
        .tips li {
            margin: 8px 0;
        }
        .cta-text {
            background: #DEEBFF;
            border: 1px solid #B3D4FF;
            padding: 15px 20px;
            border-radius: 4px;
            margin: 20px 0;
            text-align: center;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
            text-align: center;
        }
        .footer a {
            color: #0052CC;
        }
        .reassurance {
            background: #E6FCFF;
            border: 1px solid #B3F5FF;
            padding: 15px 20px;
            border-radius: 4px;
            margin: 20px 0;
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
            
            <div class="alert-box">
                <div class="time">${hoursInactive}h</div>
                <div class="label">since last activity</div>
            </div>
            
            <div class="last-activity">
                📅 Last activity: <strong>${lastActivityTime}</strong>
            </div>
            
            <div class="reassurance">
                <p style="margin: 0;">
                    ☕ <strong>Taking a break?</strong> That's great! This is just a friendly reminder. 
                    We know breaks are important for productivity.
                </p>
            </div>
            
            <div class="cta-text">
                <p style="margin: 0;">
                    If you intended to track your work, just open the Desktop App.<br>
                    <strong>Time tracking will automatically resume.</strong>
                </p>
            </div>
            
            <div class="tips">
                <h4>💡 Quick tips:</h4>
                <ul>
                    <li>The Desktop App tracks your activity automatically when running</li>
                    <li>You can pause tracking from the system tray icon</li>
                    <li>Idle time is automatically detected and excluded</li>
                </ul>
            </div>
            
            <p>Best regards,<br><strong>The JIRAForge Team</strong></p>
            
            <div class="footer">
                <p>You're receiving this email because you have inactivity alerts enabled.</p>
                ${settingsUrl ? `<p><a href="${settingsUrl}">Update your notification settings</a></p>` : ''}
            </div>
        </div>
    </div>
</body>
</html>
    `.trim()
};
