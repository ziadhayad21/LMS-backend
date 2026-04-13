import nodemailer from 'nodemailer';
import dns from 'dns';

// Many cloud environments have no IPv6 route; Gmail SMTP can resolve to IPv6.
// Force IPv4-first to avoid ENETUNREACH on IPv6 addresses.
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // ignore
}

const getTransport = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 20000, // Increase to 20 seconds for slow cloud networks
    socketTimeout: 20000,
  });
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransport();

  // Safe fallback (dev/misconfigured SMTP): log instead of crashing.
  if (!transport) {
    // eslint-disable-next-line no-console
    console.warn('[email] SMTP not configured. Email not sent.', { to, subject });
    if (text) console.warn(text);
    return;
  }

  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
  try {
    await transport.sendMail({ from, to, subject, html, text });
    // eslint-disable-next-line no-console
    console.log(`[email] Successfully sent to ${to}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[email] Failed to send email to ${to}:`, error?.message || error);
    // Keep caller flows resilient; upstream can still decide what to do,
    // but by default we don't crash auth flows due to SMTP/network issues.
    return;
  }
};

