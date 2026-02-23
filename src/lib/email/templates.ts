/**
 * Email templates for YaadBooks.
 *
 * Each template function returns { subject, html, text } suitable for
 * passing directly to sendEmail(). Templates use inline styles for
 * maximum email client compatibility.
 */

// ─── Shared layout helpers ───────────────────────────────────────────

const BRAND_COLOR = '#1976D2';
const ACCENT_COLOR = '#FF9800';
const TEXT_COLOR = '#333333';
const MUTED_COLOR = '#666666';

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">YaadBooks</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:${TEXT_COLOR};font-size:15px;line-height:1.6;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:${MUTED_COLOR};text-align:center;">
                &copy; ${new Date().getFullYear()} YaadBooks &mdash; Jamaica-First Accounting
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function button(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${BRAND_COLOR};border-radius:6px;">
      <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">${escapeHtml(text)}</a>
    </td>
  </tr>
</table>`;
}

function formatCurrency(amount: string | number, currency: string): string {
  const symbol = currency === 'USD' ? 'US$' : 'J$';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${symbol}${num.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Template: Invoice ───────────────────────────────────────────────

export interface InvoiceEmailParams {
  customerName: string;
  invoiceNumber: string;
  amount: string | number;
  currency: string;
  dueDate: string;
  companyName: string;
  viewUrl?: string;
}

export function invoiceEmail(params: InvoiceEmailParams) {
  const { customerName, invoiceNumber, amount, currency, dueDate, companyName, viewUrl } = params;
  const formattedAmount = formatCurrency(amount, currency);

  const subject = `Invoice ${invoiceNumber} from ${companyName}`;

  const body = `
    <p>Dear ${escapeHtml(customerName)},</p>
    <p>${escapeHtml(companyName)} has sent you an invoice.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Invoice Number</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(invoiceNumber)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Amount Due</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:18px;font-weight:700;color:${BRAND_COLOR};">${formattedAmount}</td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-weight:600;">Due Date</td>
        <td style="padding:12px 16px;">${escapeHtml(dueDate)}</td>
      </tr>
    </table>
    ${viewUrl ? button('View Invoice', viewUrl) : ''}
    <p style="color:${MUTED_COLOR};font-size:13px;">If you have any questions, please contact ${escapeHtml(companyName)} directly.</p>
  `;

  const text = [
    `Dear ${customerName},`,
    '',
    `${companyName} has sent you an invoice.`,
    '',
    `Invoice Number: ${invoiceNumber}`,
    `Amount Due: ${formattedAmount}`,
    `Due Date: ${dueDate}`,
    '',
    viewUrl ? `View Invoice: ${viewUrl}` : '',
    '',
    `If you have any questions, please contact ${companyName} directly.`,
  ].join('\n');

  return { subject, html: layout(subject, body), text };
}

// ─── Template: Payment Reminder ──────────────────────────────────────

export interface PaymentReminderEmailParams {
  customerName: string;
  invoiceNumber: string;
  amount: string | number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  companyName: string;
  severity: 'mild' | 'moderate' | 'severe';
}

export function paymentReminderEmail(params: PaymentReminderEmailParams) {
  const { customerName, invoiceNumber, amount, currency, dueDate, daysOverdue, companyName, severity } = params;
  const formattedAmount = formatCurrency(amount, currency);

  const severityConfig = {
    mild: {
      subject: `Friendly Reminder: Invoice ${invoiceNumber} is past due`,
      color: ACCENT_COLOR,
      heading: 'Payment Reminder',
      message: `This is a friendly reminder that invoice ${invoiceNumber} was due on ${dueDate} and is now ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue.`,
    },
    moderate: {
      subject: `Second Notice: Invoice ${invoiceNumber} is ${daysOverdue} days overdue`,
      color: '#E65100',
      heading: 'Payment Overdue',
      message: `Invoice ${invoiceNumber} is now ${daysOverdue} days past its due date of ${dueDate}. Please arrange payment at your earliest convenience to avoid further action.`,
    },
    severe: {
      subject: `Urgent: Invoice ${invoiceNumber} is ${daysOverdue} days overdue - Immediate Action Required`,
      color: '#C62828',
      heading: 'Urgent Payment Required',
      message: `Invoice ${invoiceNumber} is now ${daysOverdue} days past its due date of ${dueDate}. Immediate payment is required to avoid service interruption or further collection action.`,
    },
  };

  const config = severityConfig[severity];

  const body = `
    <div style="background-color:${config.color};color:#ffffff;padding:12px 16px;border-radius:6px;margin-bottom:20px;">
      <strong>${config.heading}</strong>
    </div>
    <p>Dear ${escapeHtml(customerName)},</p>
    <p>${config.message}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Invoice Number</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(invoiceNumber)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Amount Due</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:18px;font-weight:700;color:${config.color};">${formattedAmount}</td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Original Due Date</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(dueDate)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-weight:600;">Days Overdue</td>
        <td style="padding:12px 16px;font-weight:700;color:${config.color};">${daysOverdue}</td>
      </tr>
    </table>
    <p>Please arrange payment as soon as possible. If payment has already been made, please disregard this notice.</p>
    <p style="color:${MUTED_COLOR};font-size:13px;">Regards,<br />${escapeHtml(companyName)}</p>
  `;

  const text = [
    `${config.heading}`,
    '',
    `Dear ${customerName},`,
    '',
    config.message,
    '',
    `Invoice Number: ${invoiceNumber}`,
    `Amount Due: ${formattedAmount}`,
    `Original Due Date: ${dueDate}`,
    `Days Overdue: ${daysOverdue}`,
    '',
    'Please arrange payment as soon as possible. If payment has already been made, please disregard this notice.',
    '',
    `Regards,`,
    companyName,
  ].join('\n');

  return { subject: config.subject, html: layout(config.subject, body), text };
}

// ─── Template: Payslip ───────────────────────────────────────────────

export interface PayslipEmailParams {
  employeeName: string;
  payPeriod: string;
  netPay: string | number;
  currency: string;
  companyName: string;
}

export function payslipEmail(params: PayslipEmailParams) {
  const { employeeName, payPeriod, netPay, currency, companyName } = params;
  const formattedPay = formatCurrency(netPay, currency);

  const subject = `Your Payslip for ${payPeriod} - ${companyName}`;

  const body = `
    <p>Dear ${escapeHtml(employeeName)},</p>
    <p>Your payslip for the period <strong>${escapeHtml(payPeriod)}</strong> is now available.</p>
    <div style="background-color:#f0f7ff;border:1px solid #bbdefb;border-radius:6px;padding:20px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 4px 0;font-size:13px;color:${MUTED_COLOR};">Net Pay</p>
      <p style="margin:0;font-size:28px;font-weight:700;color:${BRAND_COLOR};">${formattedPay}</p>
    </div>
    <p>Please log in to your YaadBooks account to view the full breakdown of your earnings and deductions.</p>
    <p style="color:${MUTED_COLOR};font-size:13px;">If you have any questions about your payslip, please contact your employer.</p>
    <p>Regards,<br />${escapeHtml(companyName)}</p>
  `;

  const text = [
    `Dear ${employeeName},`,
    '',
    `Your payslip for the period ${payPeriod} is now available.`,
    '',
    `Net Pay: ${formattedPay}`,
    '',
    'Please log in to your YaadBooks account to view the full breakdown of your earnings and deductions.',
    '',
    'If you have any questions about your payslip, please contact your employer.',
    '',
    `Regards,`,
    companyName,
  ].join('\n');

  return { subject, html: layout(subject, body), text };
}

// ─── Template: Security Alert ────────────────────────────────────────

export interface SecurityAlertEmailParams {
  userName: string;
  alertType: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export function securityAlertEmail(params: SecurityAlertEmailParams) {
  const { userName, alertType, details, timestamp, ipAddress } = params;

  const subject = `Security Alert: ${alertType}`;

  const body = `
    <div style="background-color:#C62828;color:#ffffff;padding:12px 16px;border-radius:6px;margin-bottom:20px;">
      <strong>Security Alert</strong>
    </div>
    <p>Hello ${escapeHtml(userName)},</p>
    <p>We detected the following security event on your account:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Alert Type</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(alertType)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Details</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(details)}</td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-weight:600;${ipAddress ? 'border-bottom:1px solid #e5e7eb;' : ''}">Time</td>
        <td style="padding:12px 16px;${ipAddress ? 'border-bottom:1px solid #e5e7eb;' : ''}">${escapeHtml(timestamp)}</td>
      </tr>
      ${ipAddress ? `<tr>
        <td style="padding:12px 16px;font-weight:600;">IP Address</td>
        <td style="padding:12px 16px;">${escapeHtml(ipAddress)}</td>
      </tr>` : ''}
    </table>
    <p>If this was you, no action is needed. If you did not perform this action, please secure your account immediately by changing your password and enabling two-factor authentication.</p>
    <p style="color:${MUTED_COLOR};font-size:13px;">This is an automated security notification from YaadBooks.</p>
  `;

  const text = [
    `Security Alert`,
    '',
    `Hello ${userName},`,
    '',
    'We detected the following security event on your account:',
    '',
    `Alert Type: ${alertType}`,
    `Details: ${details}`,
    `Time: ${timestamp}`,
    ipAddress ? `IP Address: ${ipAddress}` : '',
    '',
    'If this was you, no action is needed. If you did not perform this action, please secure your account immediately by changing your password and enabling two-factor authentication.',
  ].filter(Boolean).join('\n');

  return { subject, html: layout(subject, body), text };
}

// ─── Template: Welcome ───────────────────────────────────────────────

export interface WelcomeEmailParams {
  userName: string;
  companyName: string;
}

export function welcomeEmail(params: WelcomeEmailParams) {
  const { userName, companyName } = params;

  const subject = `Welcome to YaadBooks, ${userName}!`;

  const body = `
    <p>Hello ${escapeHtml(userName)},</p>
    <p>Welcome to <strong>YaadBooks</strong>! Your account for <strong>${escapeHtml(companyName)}</strong> has been set up and is ready to use.</p>
    <p>Here are a few things you can do to get started:</p>
    <ul style="padding-left:20px;">
      <li style="margin-bottom:8px;">Set up your company profile and upload your logo</li>
      <li style="margin-bottom:8px;">Add your customers and products</li>
      <li style="margin-bottom:8px;">Create your first invoice</li>
      <li style="margin-bottom:8px;">Connect your bank accounts</li>
      <li style="margin-bottom:8px;">Configure your GCT settings</li>
    </ul>
    <p>YaadBooks is built for Jamaican businesses, with full support for GCT, statutory payroll deductions (PAYE, NIS, NHT, Education Tax), and Jamaica-specific tax reporting.</p>
    <p>If you need help getting started, check out our documentation or reach out to our support team.</p>
    <p>Regards,<br />The YaadBooks Team</p>
  `;

  const text = [
    `Hello ${userName},`,
    '',
    `Welcome to YaadBooks! Your account for ${companyName} has been set up and is ready to use.`,
    '',
    'Here are a few things you can do to get started:',
    '- Set up your company profile and upload your logo',
    '- Add your customers and products',
    '- Create your first invoice',
    '- Connect your bank accounts',
    '- Configure your GCT settings',
    '',
    'YaadBooks is built for Jamaican businesses, with full support for GCT, statutory payroll deductions (PAYE, NIS, NHT, Education Tax), and Jamaica-specific tax reporting.',
    '',
    'If you need help getting started, check out our documentation or reach out to our support team.',
    '',
    'Regards,',
    'The YaadBooks Team',
  ].join('\n');

  return { subject, html: layout(subject, body), text };
}

// ─── Template: Password Reset ────────────────────────────────────

export interface PasswordResetEmailParams {
  userName: string;
  resetUrl: string;
}

export function passwordResetEmail(params: PasswordResetEmailParams) {
  const { userName, resetUrl } = params;

  const subject = 'Reset Your YaadBooks Password';

  const body = `
    <p>Hello ${escapeHtml(userName)},</p>
    <p>We received a request to reset the password for your YaadBooks account. Click the button below to choose a new password:</p>
    ${button('Reset Password', resetUrl)}
    <p>This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email &mdash; your password will not be changed.</p>
    <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:${MUTED_COLOR};font-size:13px;">
      If the button above doesn&rsquo;t work, copy and paste this URL into your browser:<br />
      <a href="${escapeHtml(resetUrl)}" style="color:${BRAND_COLOR};word-break:break-all;">${escapeHtml(resetUrl)}</a>
    </p>
  `;

  const text = [
    `Hello ${userName},`,
    '',
    'We received a request to reset the password for your YaadBooks account.',
    '',
    'Reset your password by visiting this link:',
    resetUrl,
    '',
    'This link will expire in 1 hour.',
    '',
    'If you did not request a password reset, you can safely ignore this email - your password will not be changed.',
  ].join('\n');

  return { subject, html: layout(subject, body), text };
}

// ─── Template: Tax Deadline ──────────────────────────────────────────

export interface TaxDeadlineEmailParams {
  companyName: string;
  deadlineName: string;
  dueDate: string;
  daysUntilDue: number;
}

export function taxDeadlineEmail(params: TaxDeadlineEmailParams) {
  const { companyName, deadlineName, dueDate, daysUntilDue } = params;

  const isUrgent = daysUntilDue <= 3;
  const urgencyColor = isUrgent ? '#C62828' : ACCENT_COLOR;

  const subject = daysUntilDue <= 0
    ? `Tax Deadline TODAY: ${deadlineName}`
    : `Tax Deadline in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}: ${deadlineName}`;

  const urgencyLabel = daysUntilDue <= 0
    ? 'Due Today'
    : daysUntilDue === 1
      ? 'Due Tomorrow'
      : `Due in ${daysUntilDue} Days`;

  const body = `
    <div style="background-color:${urgencyColor};color:#ffffff;padding:12px 16px;border-radius:6px;margin-bottom:20px;">
      <strong>Tax Deadline Reminder &mdash; ${urgencyLabel}</strong>
    </div>
    <p>Hello,</p>
    <p>This is a reminder that the following tax deadline is approaching for <strong>${escapeHtml(companyName)}</strong>:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Deadline</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${escapeHtml(deadlineName)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-weight:600;border-bottom:1px solid #e5e7eb;">Due Date</td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${urgencyColor};">${escapeHtml(dueDate)}</td>
      </tr>
      <tr style="background-color:#f9fafb;">
        <td style="padding:12px 16px;font-weight:600;">Days Remaining</td>
        <td style="padding:12px 16px;font-weight:700;color:${urgencyColor};">${daysUntilDue <= 0 ? 'TODAY' : daysUntilDue}</td>
      </tr>
    </table>
    <p>Please ensure all required filings and payments are completed before the deadline to avoid penalties from Tax Administration Jamaica (TAJ).</p>
    <p style="color:${MUTED_COLOR};font-size:13px;">This is an automated reminder from YaadBooks.</p>
  `;

  const text = [
    `Tax Deadline Reminder - ${urgencyLabel}`,
    '',
    `This is a reminder that the following tax deadline is approaching for ${companyName}:`,
    '',
    `Deadline: ${deadlineName}`,
    `Due Date: ${dueDate}`,
    `Days Remaining: ${daysUntilDue <= 0 ? 'TODAY' : daysUntilDue}`,
    '',
    'Please ensure all required filings and payments are completed before the deadline to avoid penalties from Tax Administration Jamaica (TAJ).',
  ].join('\n');

  return { subject, html: layout(subject, body), text };
}
