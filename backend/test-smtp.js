import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function main() {
  console.log('Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('Transporter verification successful!');

    console.log('Sending test email to', process.env.SMTP_USER);
    const info = await transporter.sendMail({
      from: `"Workshop Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'Workshop SMTP test',
      text: 'SMTP is working correctly!',
    });
    console.log('Email sent successfully! Message ID:', info.messageId);
  } catch (err) {
    console.error('SMTP test failed:', err);
  }
}

main();
