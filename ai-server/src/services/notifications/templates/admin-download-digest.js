/**
 * Admin Download Digest Email Template
 *
 * Sent to org owners/admins when one or more team members have not yet
 * installed the JIRAForge Desktop App. Lists all affected members in a table.
 */

module.exports = {
    subject: ({ orgName }) => `[JIRAForge] ${orgName}: Members haven't installed the Desktop App`,

    text: ({ displayName, orgName, users, downloadUrl }) => {
        const lines = users.map(u => `  - ${u.name} (${u.email})`).join('\n');
        return `Hi ${displayName},\n\nThe following members in ${orgName} haven't installed the JIRAForge Desktop App yet:\n\n${lines}\n\nShare this download link with them: ${downloadUrl}\n`;
    },

    html: ({ displayName, orgName, users, downloadUrl }) => {
        const rows = users.map(u => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee">${u.name}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px">${u.email}</td>
            </tr>`).join('');

        return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:4px;margin-bottom:24px">
    <h2 style="margin:0;color:#1d4ed8;font-size:18px">Desktop App Not Installed</h2>
    <p style="margin:6px 0 0;color:#1e40af;font-size:14px">${orgName}</p>
  </div>
  <p>Hi ${displayName},</p>
  <p>The following members in <strong>${orgName}</strong> haven't installed the Desktop App yet and won't have their work tracked:</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Member</th>
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Email</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Share the download link with them:</p>
  <p>
    <a href="${downloadUrl}" style="display:inline-block;background:#0052cc;color:#fff;padding:10px 24px;text-decoration:none;border-radius:4px;font-weight:600">
      Download Desktop App
    </a>
  </p>
  <p style="color:#666;font-size:13px;margin-top:24px">
    You are receiving this because you are an admin of <strong>${orgName}</strong> on JIRAForge.
  </p>
</body>
</html>`;
    }
};
