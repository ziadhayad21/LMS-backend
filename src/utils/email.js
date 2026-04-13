import nodemailer from 'nodemailer';

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
    host: 'smtp.gmail.com', // Use direct host
    port: 587,
    secure: false, // Must be false for 587/STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 20000, // Increase to 20 seconds for slow cloud networks
    socketTimeout: 20000,
    family: 4,
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
    console.error(`[email] Failed to send email to ${to}:`, error.message);
  }
};

