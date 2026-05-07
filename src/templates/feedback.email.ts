import type { FeedbackCategory } from "../api/models/feedback.model.js";

export type FeedbackEmailViewModel = {
  submittedByEmail: string;
  message: string;
  category: FeedbackCategory;
  submittedAtIsoString: string;
};

export type BuiltFeedbackEmail = {
  subject: string;
  html: string;
  text: string;
};

const escapeHtml = (rawValue: string): string =>
  rawValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildFeedbackEmail = (
  viewModel: FeedbackEmailViewModel,
): BuiltFeedbackEmail => {
  const safeMessage = escapeHtml(viewModel.message).replace(/\n/g, "<br />");
  const safeEmail = escapeHtml(viewModel.submittedByEmail);
  const safeCategory = escapeHtml(viewModel.category);
  const safeSubmittedAt = escapeHtml(viewModel.submittedAtIsoString);

  return {
    subject: `GrowTrace feedback: ${viewModel.category}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;">
        <h2 style="margin:0 0 12px;">New Feedback Received</h2>
        <p><strong>User Email:</strong> ${safeEmail}</p>
        <p><strong>Category:</strong> ${safeCategory}</p>
        <p><strong>Submitted At (UTC):</strong> ${safeSubmittedAt}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <p style="margin:0;"><strong>Message</strong></p>
        <p style="white-space:pre-wrap;">${safeMessage}</p>
      </div>
    `,
    text: [
      "New Feedback Received",
      `User Email: ${viewModel.submittedByEmail}`,
      `Category: ${viewModel.category}`,
      `Submitted At (UTC): ${viewModel.submittedAtIsoString}`,
      "",
      "Message:",
      viewModel.message,
    ].join("\n"),
  };
};
