import nodemailer from "nodemailer";

import { env } from "../config/env";

let mailTransporter: nodemailer.Transporter | null = null;

const createMailTransporter = (): nodemailer.Transporter => {
  if (mailTransporter) {
    return mailTransporter;
  }

  mailTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  return mailTransporter;
};

export const getMailTransporter = (): nodemailer.Transporter =>
  createMailTransporter();

export const sendPasswordResetEmail = async (
  recipientEmail: string,
  resetLink: string,
): Promise<void> => {
  const transporter = getMailTransporter();

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: recipientEmail,
    subject: "GrowTrace password reset",
    text: `Use this link to reset your password. This link is valid for 10 minutes: ${resetLink}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px;">Reset your GrowTrace password</h2>
        <p style="margin: 0 0 12px;">You requested a password reset.</p>
        <p style="margin: 0 0 12px;">
          <a href="${resetLink}" style="color: #4f46e5; text-decoration: none;">Reset Password</a>
        </p>
        <p style="margin: 0;">This link expires in 10 minutes.</p>
      </div>
    `,
  });
};
