import nodemailer from 'nodemailer';
import dns from 'dns';

// Many cloud environments have no IPv6 route; Gmail SMTP can resolve to IPv6.
import axios from 'axios';

export const sendEmail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.SMTP_PASS; // We use the same API Key field
  const senderEmail = process.env.SMTP_USER || 'hyadz0211@gmail.com';

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn('[email] API Key missing. Email not sent.');
    return;
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { email: senderEmail, name: 'English LMS' },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text || '',
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 201 || response.status === 200) {
      // eslint-disable-next-line no-console
      console.log(`[email-api] Successfully sent to ${to}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[email-api] Failed to send to ${to}:`,
      error.response?.data?.message || error.message
    );
    throw error;
  }
};
