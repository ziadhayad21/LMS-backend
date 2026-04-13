import twilio from 'twilio';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
} = process.env;

let client;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

export const sendSMS = async ({ to, message }) => {
  if (!client || !TWILIO_PHONE_NUMBER) {
    // eslint-disable-next-line no-console
    console.warn('[SMS] Twilio not configured. SMS not sent.', { to, message });
    return false;
  }

  try {
    // Ensure Egypt prefix if missing (+2)
    const formattedTo = to.startsWith('+') ? to : `+2${to}`;

    await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: formattedTo,
    });
    
    // eslint-disable-next-line no-console
    console.log(`[SMS] Successfully sent to ${formattedTo}`);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[SMS] Error sending via Twilio:', error.message);
    return false;
  }
};
