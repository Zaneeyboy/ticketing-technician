import { Resend } from 'resend';

// Lazy-initialize so missing key during build-time static analysis doesn't crash
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY environment variable is not set');
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@caribbeanroasters.com';
const APP_NAME = 'Caribbean Roasters Technician Portal';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const ROLE_LABELS: Record<string, string> = {
  store_admin: 'Store Administrator',
  store_manager: 'Store Manager',
  call_admin: 'Call Administrator',
  technician: 'Technician',
  manager: 'Manager',
};

// â”€â”€â”€ Shared HTML helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1d4ed8;padding:28px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${APP_NAME}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e4e4e7;background:#fafafa;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;">
                This email was sent by ${APP_NAME}. If you weren't expecting this, you can safely ignore it.
                <br/>Do not share your invitation link with anyone.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#1d4ed8;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>`;
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;font-size:13px;color:#71717a;width:130px;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:#18181b;font-weight:500;">${value}</td>
  </tr>`;
}

// â”€â”€â”€ sendInviteEmail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SendInviteEmailParams {
  to: string;
  name: string;
  role: string;
  storeName: string | null;
  joinUrl: string;
  invitedByName: string;
}

export async function sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
  const { to, name, role, storeName, joinUrl, invitedByName } = params;
  const roleLabel = ROLE_LABELS[role] ?? role;
  const storeLine = storeName ? `at <strong>${storeName}</strong>` : 'on the platform';
  const firstName = name.split(' ')[0];

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">You've been invited, ${firstName}!</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
      <strong>${invitedByName}</strong> has invited you to join ${APP_NAME} ${storeLine} as a <strong>${roleLabel}</strong>.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tbody>
        ${infoRow('Your name', name)}
        ${infoRow('Role', roleLabel)}
        ${storeName ? infoRow('Store', storeName) : ''}
        ${infoRow('Invited by', invitedByName)}
        ${infoRow('Expires in', '72 hours')}
      </tbody>
    </table>

    <p style="margin:0 0 16px;font-size:14px;color:#52525b;">Click the button below to set your password and complete account setup:</p>
    ${ctaButton(joinUrl, 'Accept Invitation â†’')}

    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">
      Or copy this link into your browser:<br/>
      <a href="${joinUrl}" style="color:#1d4ed8;word-break:break-all;">${joinUrl}</a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#ef4444;font-weight:500;">
      âš ï¸ This link expires in 72 hours. If it expires, ask your administrator to resend the invitation.
    </p>
  `;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `You've been invited to ${APP_NAME}${storeName ? ` â€” ${storeName}` : ''}`,
    html: emailWrapper(body),
  });
}

// â”€â”€â”€ sendStoreAdminInviteEmail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Variant for newly onboarded stores â€” more onboarding-flavoured messaging

export interface SendStoreAdminInviteEmailParams {
  to: string;
  name: string;
  storeName: string;
  storeIsland: string;
  joinUrl: string;
  invitedByName: string;
}

export async function sendStoreAdminInviteEmail(params: SendStoreAdminInviteEmailParams): Promise<void> {
  const { to, name, storeName, storeIsland, joinUrl, invitedByName } = params;
  const firstName = name.split(' ')[0];

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Welcome to Caribbean Roasters, ${firstName}!</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
      Your store, <strong>${storeName}</strong> (${storeIsland}), has been set up on ${APP_NAME}.
      <strong>${invitedByName}</strong> has designated you as the <strong>Store Administrator</strong> â€” you'll have full control over your store's tickets, customers, and team.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tbody>
        ${infoRow('Store', storeName)}
        ${infoRow('Location', storeIsland)}
        ${infoRow('Your role', 'Store Administrator')}
        ${infoRow('Set up by', invitedByName)}
        ${infoRow('Invite expires', '72 hours')}
      </tbody>
    </table>

    <p style="margin:0 0 16px;font-size:14px;color:#52525b;">Accept the invitation below to create your password and get started:</p>
    ${ctaButton(joinUrl, 'Set Up My Account â†’')}

    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">
      Or copy this link into your browser:<br/>
      <a href="${joinUrl}" style="color:#1d4ed8;word-break:break-all;">${joinUrl}</a>
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:#52525b;line-height:1.6;background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;">
      <strong>âš ï¸ This link expires in 72 hours.</strong> If you don't accept in time, ask your HQ administrator to resend the invitation from the Users page.
    </p>
  `;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Your store ${storeName} is ready â€” complete your account setup`,
    html: emailWrapper(body),
  });
}

// â”€â”€â”€ Ticket email helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TicketMachineSummary {
  customerName: string;
  machineType: string;
  serialNumber: string;
  priority: string;
}

function machineRows(machines: TicketMachineSummary[]) {
  if (!machines.length) return '';
  const rows = machines
    .map(
      (m) => `<tr>
        <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e4e4e7;">${m.customerName}</td>
        <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e4e4e7;">${m.machineType}</td>
        <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e4e4e7;font-family:monospace;">${m.serialNumber}</td>
        <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e4e4e7;">
          <span style="padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${priorityBg(m.priority)};color:${priorityColor(m.priority)};">${m.priority}</span>
        </td>
      </tr>`,
    )
    .join('');
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <thead>
        <tr style="background:#f4f4f5;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.05em;">Customer</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.05em;">Machine</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.05em;">Serial #</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.05em;">Priority</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function priorityBg(p: string) {
  return p === 'Urgent' ? '#fee2e2' : p === 'High' ? '#ffedd5' : p === 'Medium' ? '#fef9c3' : '#f0fdf4';
}
function priorityColor(p: string) {
  return p === 'Urgent' ? '#b91c1c' : p === 'High' ? '#c2410c' : p === 'Medium' ? '#854d0e' : '#166534';
}

// â”€â”€â”€ sendTicketCreatedEmail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sent to the call admin (or whoever created the ticket) as confirmation.

export interface SendTicketCreatedEmailParams {
  to: string;
  creatorName: string;
  ticketNumber: string;
  ticketId: string;
  storeName: string;
  machines: TicketMachineSummary[];
  issueDescription: string;
  assignedToName: string | null;
  scheduledDate: Date | null;
}

export async function sendTicketCreatedEmail(params: SendTicketCreatedEmailParams): Promise<void> {
  const { to, creatorName, ticketNumber, ticketId, storeName, machines, issueDescription, assignedToName, scheduledDate } = params;
  const firstName = creatorName.split(' ')[0];
  const ticketUrl = `${APP_URL}/tickets`;

  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#18181b;">Ticket Created</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;">Hi ${firstName}, your ticket has been logged successfully.</p>

    <div style="background:#f4f4f5;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:18px;font-weight:700;color:#1d4ed8;font-family:monospace;">${ticketNumber}</span>
      <span style="font-size:13px;color:#52525b;">Â· ${storeName}</span>
    </div>

    ${machineRows(machines)}

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
      <tbody>
        ${infoRow('Issue', issueDescription)}
        ${assignedToName ? infoRow('Assigned to', assignedToName) : infoRow('Status', 'Unassigned â€” pending dispatch')}
        ${scheduledDate ? infoRow('Scheduled visit', scheduledDate.toLocaleDateString('en-TT', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })) : ''}
      </tbody>
    </table>

    ${ctaButton(ticketUrl, 'View Tickets â†’')}
  `;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Ticket ${ticketNumber} created â€” ${machines[0]?.customerName ?? storeName}`,
    html: emailWrapper(body),
  });
}

// â”€â”€â”€ sendTicketAssignedEmail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sent to the technician when they are assigned to a ticket at creation time.

export interface SendTicketAssignedEmailParams {
  to: string;
  technicianName: string;
  ticketNumber: string;
  ticketId: string;
  storeName: string;
  machines: TicketMachineSummary[];
  issueDescription: string;
  createdByName: string;
  scheduledDate: Date | null;
}

export async function sendTicketAssignedEmail(params: SendTicketAssignedEmailParams): Promise<void> {
  const { to, technicianName, ticketNumber, ticketId, storeName, machines, issueDescription, createdByName, scheduledDate } = params;
  const firstName = technicianName.split(' ')[0];
  const ticketUrl = `${APP_URL}/tickets`;

  const body = `
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#18181b;">You've been assigned a ticket</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;">Hi ${firstName}, a new service request has been assigned to you.</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <span style="font-size:18px;font-weight:700;color:#1d4ed8;font-family:monospace;">${ticketNumber}</span>
      <span style="font-size:13px;color:#52525b;margin-left:8px;">Â· ${storeName}</span>
    </div>

    ${machineRows(machines)}

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
      <tbody>
        ${infoRow('Issue', issueDescription)}
        ${infoRow('Logged by', createdByName)}
        ${scheduledDate ? infoRow('Scheduled visit', scheduledDate.toLocaleDateString('en-TT', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })) : infoRow('Scheduled visit', 'TBD â€” check with your manager')}
      </tbody>
    </table>

    ${ctaButton(ticketUrl, 'View My Tickets â†’')}
  `;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `[Assigned] ${ticketNumber} â€” ${machines[0]?.customerName ?? storeName}`,
    html: emailWrapper(body),
  });
}

// â”€â”€â”€ sendWelcomeEmail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sent to a user after they successfully accept their invitation.

export interface SendWelcomeEmailParams {
  to: string;
  name: string;
  role: string;
  storeName: string | null;
  loginUrl: string;
}

export async function sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<void> {
  const { to, name, role, storeName, loginUrl } = params;
  const firstName = name.split(' ')[0];
  const roleLabel = ROLE_LABELS[role] ?? role;
  const storeLine = storeName ? ` at <strong>${storeName}</strong>` : '';

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Welcome aboard, ${firstName}!</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
      Your account is all set. You&rsquo;re now a <strong>${roleLabel}</strong>${storeLine} on ${APP_NAME}.
      Log in any time to get started.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tbody>
        ${infoRow('Name', name)}
        ${infoRow('Role', roleLabel)}
        ${storeName ? infoRow('Store', storeName) : ''}
      </tbody>
    </table>

    ${ctaButton(loginUrl, 'Log In Now â†’')}

    <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">
      Bookmark your login page for quick access:<br/>
      <a href="${loginUrl}" style="color:#1d4ed8;">${loginUrl}</a>
    </p>
  `;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Welcome to ${APP_NAME} â€” your account is ready`,
    html: emailWrapper(body),
  });
}
