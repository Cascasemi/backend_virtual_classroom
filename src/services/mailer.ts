import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

const transporter = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: ENV.SMTP_PORT,
  secure: ENV.SMTP_PORT === 465,
  auth: ENV.SMTP_USER ? { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS } : undefined,
});

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${ENV.APP_URL}/verify?email=${encodeURIComponent(email)}&token=${token}`;
  await transporter.sendMail({
    from: ENV.EMAIL_FROM,
    to: email,
    subject: 'Verify your email',
    html: `<p>Click to verify: <a href="${verifyUrl}">${verifyUrl}</a></p>`
  });
}

export async function sendResetEmail(email: string, token: string) {
  const resetUrl = `${ENV.APP_URL}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
  await transporter.sendMail({
    from: ENV.EMAIL_FROM,
    to: email,
    subject: 'Reset your password',
    html: `<p>Click to reset password: <a href="${resetUrl}">${resetUrl}</a></p>`
  });
}
