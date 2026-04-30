import nodemailer, { SendMailOptions } from "nodemailer";

import { env } from "../config/env";
import {
  buildAlertEmail,
  type AlertEmailViewModel,
} from "../templates/alert.email";
import {
  buildWeeklyReportEmail,
  type WeeklyReportEmailViewModel,
} from "../templates/weeklyReport.email";

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

export type SendWeeklyReportEmailParameters = {
  recipientEmail: string;
  recipientFullName: string;
  viewModel: WeeklyReportEmailViewModel;
};

export type SendWeeklyReportEmailResult = {
  messageId: string;
};

export const sendWeeklyReportEmail = async (
  parameters: SendWeeklyReportEmailParameters,
): Promise<SendWeeklyReportEmailResult> => {
  const transporter = getMailTransporter();
  const builtEmail = buildWeeklyReportEmail(parameters.viewModel);

  const fromAddress = env.WEEKLY_REPORTS_EMAIL_FROM ?? env.SMTP_FROM;
  const formattedRecipient = parameters.recipientFullName
    ? `${parameters.recipientFullName} <${parameters.recipientEmail}>`
    : parameters.recipientEmail;

  const sendResult = await transporter.sendMail({
    from: fromAddress,
    to: formattedRecipient,
    subject: builtEmail.subject,
    html: builtEmail.html,
    text: builtEmail.text,
  });

  return { messageId: sendResult.messageId };
};

export type SendAlertEmailParameters = {
  recipientEmail: string;
  recipientFullName: string | null;
  viewModel: AlertEmailViewModel;
};

export type SendAlertEmailResult = {
  messageId: string;
};

export const sendAlertEmail = async (
  parameters: SendAlertEmailParameters,
): Promise<SendAlertEmailResult> => {
  const transporter = getMailTransporter();
  const builtEmail = buildAlertEmail(parameters.viewModel);

  const fromAddress = env.ALERTS_FROM_EMAIL ?? env.SMTP_FROM;
  const formattedRecipient = parameters.recipientFullName
    ? `${parameters.recipientFullName} <${parameters.recipientEmail}>`
    : parameters.recipientEmail;

  const sendResult = await transporter.sendMail({
    from: fromAddress,
    to: formattedRecipient,
    subject: builtEmail.subject,
    html: builtEmail.html,
    text: builtEmail.text,
  });

  return { messageId: sendResult.messageId };
};
