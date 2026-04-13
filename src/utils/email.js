import nodemailer from 'nodemailer';
import dns from 'dns';

// Many cloud environments have no IPv6 route; Gmail SMTP can resolve to IPv6.
import axios from 'axios';

export const sendEmail = async ({ to, subject, html, text }) => {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbydP0foLYBcBZhjXVEKB1Spi6ycVYybL7i-7-BZ8bNquiwOViGivfER6ydJga6uirxkxg/exec';

  try {
    const response = await axios.post(
      scriptUrl,
      {
        to: to,
        subject: subject,
        html: html,
        text: text || '',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data?.status === 'success' || response.status === 200) {
      // eslint-disable-next-line no-console
      console.log(`[email-gas] Successfully sent to ${to} via Google Apps Script`);
    } else {
      console.error('[email-gas] Unexpected response from script:', response.data);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[email-gas] Failed to send to ${to}:`,
      error.message
    );
    throw error;
  }
};

