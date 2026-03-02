/**
 * Admin Inactivity Digest Email Template
 *
 * Sent to org owners/admins when one or more team members have been inactive
 * for longer than the configured threshold. Lists all affected members in a table.
 */

module.exports = {
    type: 'admin_inactivity_digest',
    subject: ({ orgName }) => `[JIRAForge] ${orgName}: Team members inactive`,

    text: ({ displayName, orgName, inactiveUsers }) => {
        const lines = inactiveUsers.map(u =>
            `  - ${u.name}: inactive for ${u.hoursInactive}h (last active: ${u.lastActivity})`
        ).join('\n');
        return `Hi ${displayName},\n\nThe following team members in ${orgName} have been inactive:\n\n${lines}\n\nLog in to JIRAForge to review your team's activity.\n`;
    },

    html: ({ displayName, orgName, inactiveUsers }) => {
        const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const rows = inactiveUsers.map(u => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee">${esc(u.name)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#d97706;font-weight:600">${esc(u.hoursInactive)}h inactive</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#999;font-size:13px">${esc(u.lastActivity)}</td>
            </tr>`).join('');

        return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#fff7ed;border-left:4px solid #f97316;padding:16px 20px;border-radius:4px;margin-bottom:24px">
    <h2 style="margin:0;color:#c2410c;font-size:18px">Team Inactivity Alert</h2>
    <p style="margin:6px 0 0;color:#92400e;font-size:14px">${esc(orgName)}</p>
  </div>
  <p>Hi ${esc(displayName)},</p>
  <p>The following team members in <strong>${esc(orgName)}</strong> have been inactive and may need a nudge:</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Member</th>
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Inactive For</th>
        <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Last Active</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="color:#666;font-size:13px;margin-top:24px">
    You are receiving this because you are an admin of <strong>${esc(orgName)}</strong> on JIRAForge.
  </p>
</body>
</html>`;
    }
};
