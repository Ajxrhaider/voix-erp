export const sendEmail = async (to, subject, text) => {
  if (!to) return; 

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n--- [OFFLINE EMAIL STUB] ---`);
    console.log(`To: ${to}\nSubject: ${subject}\nMessage: ${text}`);
    console.log(`----------------------------\n`);
    return;
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"Voix ERP" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text
    });
    console.log(`[Email Sent] ${subject} -> ${to}`);
  } catch (error) {
    console.error(`[Email Failed] Ensure nodemailer is installed (npm install nodemailer): ${error.message}`);
  }
};