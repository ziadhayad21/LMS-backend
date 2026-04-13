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
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
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
  await transport.sendMail({ from, to, subject, html, text });
};

