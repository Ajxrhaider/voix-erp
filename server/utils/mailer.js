// import nodemailer from 'nodemailer'; // Disabled due to offline status / missing package

export const sendEmail = async (to, subject, text) => {
  if (!to) return; // Failsafe if no email addresses are found in the query

  // Offline Stub: Prevents crashes and logs the email to the console instead
  console.log(`\n--- [OFFLINE EMAIL STUB] ---`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${text}`);
  console.log(`----------------------------\n`);
};