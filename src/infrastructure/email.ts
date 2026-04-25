import nodemailer, { SendMailOptions } from "nodemailer";

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
  emailObject: SendMailOptions,
): Promise<void> => {
  const transporter = getMailTransporter();

  await transporter.sendMail(emailObject);
};

export const sendPasswordUpdatedEmail = async (
  emailObject: SendMailOptions,
): Promise<void> => {
  const transporter = getMailTransporter();

  await transporter.sendMail(emailObject);
};
