import type { AlertType } from "../api/models/alert.model";

export interface AlertEmailViewModel {
  alertType: AlertType;
  recipientFirstName: string | null;
  headline: string;
  message: string;
  supportingPoints: ReadonlyArray<{ label: string; value: string }>;
  ctaUrl: string;
  ctaLabel: string;
  manageNotificationsUrl: string;
  occurredAt: Date;
}

export interface BuiltAlertEmail {
  subject: string;
  html: string;
  text: string;
}

interface AlertVisualTheme {
  emoji: string;
  badgeBackground: string;
  badgeBorder: string;
  badgeColor: string;
  badgeLabel: string;
  accentColor: string;
}

const ALERT_VISUAL_THEMES: Record<AlertType, AlertVisualTheme> = {
  engagement_drop: {
    emoji: "&#x1F4C9;",
    badgeBackground: "#fef2f2",
    badgeBorder: "#fecaca",
    badgeColor: "#b91c1c",
    badgeLabel: "Engagement Drop",
    accentColor: "#ef4444",
  },
  traffic_spike: {
    emoji: "&#x26A1;",
    badgeBackground: "#ecfdf5",
    badgeBorder: "#a7f3d0",
    badgeColor: "#047857",
    badgeLabel: "Traffic Spike",
    accentColor: "#10b981",
  },
  top_link: {
    emoji: "&#x1F31F;",
    badgeBackground: "#eef2ff",
    badgeBorder: "#c7d2fe",
    badgeColor: "#4338ca",
    badgeLabel: "New Top Link",
    accentColor: "#6366f1",
  },
};

const escapeHtml = (rawValue: string): string =>
  rawValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTimestampLabel = (timestamp: Date): string => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  return formatter.format(timestamp);
};

const buildSupportingPointsList = (
  supportingPoints: ReadonlyArray<{ label: string; value: string }>,
): string => {
  if (supportingPoints.length === 0) {
    return "";
  }

  const rows = supportingPoints
    .map(
      (point) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(point.label)}</div>
            <div style="margin-top:4px;font-size:15px;color:#0f172a;font-weight:700;">${escapeHtml(point.value)}</div>
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
      ${rows}
    </table>
  `;
};

const buildBulletproofCtaButton = (
  href: string,
  label: string,
  accentColor: string,
): string => {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0;">
      <tr>
        <td align="center" bgcolor="${accentColor}" style="border-radius:14px;">
          <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="${accentColor}">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center>
            </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${safeHref}" style="display:inline-block;padding:14px 28px;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;background:${accentColor};">
            ${safeLabel}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;
};

const buildPlainTextFallback = (viewModel: AlertEmailViewModel): string => {
  const lines: string[] = [];
  const greetingName = viewModel.recipientFirstName
    ? `Hi ${viewModel.recipientFirstName},`
    : "Hi,";

  lines.push(greetingName);
  lines.push("");
  lines.push(viewModel.headline);
  lines.push("");
  lines.push(viewModel.message);

  if (viewModel.supportingPoints.length > 0) {
    lines.push("");
    viewModel.supportingPoints.forEach((point) => {
      lines.push(`- ${point.label}: ${point.value}`);
    });
  }

  lines.push("");
  lines.push(`${viewModel.ctaLabel}: ${viewModel.ctaUrl}`);
  lines.push("");
  lines.push(
    `Manage notification preferences: ${viewModel.manageNotificationsUrl}`,
  );

  return lines.join("\n");
};

const buildHtmlBody = (viewModel: AlertEmailViewModel): string => {
  const visualTheme = ALERT_VISUAL_THEMES[viewModel.alertType];
  const greetingName = viewModel.recipientFirstName
    ? `Hi ${escapeHtml(viewModel.recipientFirstName)},`
    : "Hi,";

  const supportingPointsMarkup = buildSupportingPointsList(
    viewModel.supportingPoints,
  );
  const ctaButtonMarkup = buildBulletproofCtaButton(
    viewModel.ctaUrl,
    viewModel.ctaLabel,
    visualTheme.accentColor,
  );

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>${escapeHtml(viewModel.headline)}</title>
        <style>
          @media (prefers-color-scheme: dark) {
            body, table, td { background:#0b1020 !important; color:#f3f4f6 !important; }
            .gt-card { background:#111827 !important; border-color:#1f2937 !important; }
            .gt-muted { color:#9ca3af !important; }
            .gt-headline { color:#ffffff !important; }
            .gt-divider { border-color:#1f2937 !important; }
          }
          @media only screen and (max-width: 600px) {
            .gt-container { width:100% !important; padding:20px !important; }
            .gt-headline { font-size:24px !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#f4f5fb;font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fb;">
          <tr>
            <td align="center" style="padding:32px 12px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="gt-container" style="width:600px;max-width:600px;background:#ffffff;border-radius:24px;padding:32px;box-shadow:0 8px 32px rgba(15,23,42,0.06);">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:800;color:#6366f1;letter-spacing:0.18em;text-transform:uppercase;">GrowTrace &middot; Growth Alert</div>
                    <div class="gt-muted" style="margin-top:4px;font-size:12px;color:#6b7280;font-weight:600;letter-spacing:0.06em;">${escapeHtml(formatTimestampLabel(viewModel.occurredAt))}</div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                      <tr>
                        <td style="padding:6px 12px;border-radius:999px;background:${visualTheme.badgeBackground};border:1px solid ${visualTheme.badgeBorder};">
                          <span style="font-size:12px;font-weight:800;color:${visualTheme.badgeColor};letter-spacing:0.08em;">${visualTheme.emoji}&nbsp;${escapeHtml(visualTheme.badgeLabel.toUpperCase())}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 class="gt-headline" style="margin:18px 0 0;font-size:28px;line-height:1.2;letter-spacing:-0.01em;color:#0f172a;font-weight:800;">${escapeHtml(viewModel.headline)}</h1>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(greetingName)}</p>
                    <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(viewModel.message)}</p>
                  </td>
                </tr>
                <tr>
                  <td>${supportingPointsMarkup}</td>
                </tr>
                <tr>
                  <td align="center">${ctaButtonMarkup}</td>
                </tr>
                <tr>
                  <td class="gt-divider" style="padding-top:28px;margin-top:28px;border-top:1px solid #e5e7eb;">
                    <div style="font-size:11px;color:#9ca3af;line-height:1.6;text-align:center;">
                      You are receiving this because growth alerts are enabled on your GrowTrace account.<br />
                      <a href="${escapeHtml(viewModel.manageNotificationsUrl)}" style="color:#6366f1;text-decoration:none;font-weight:600;">Manage notification preferences</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

const ALERT_EMAIL_SUBJECT_PREFIX = "Growth Alert";

export const buildAlertEmail = (
  viewModel: AlertEmailViewModel,
): BuiltAlertEmail => {
  const html = buildHtmlBody(viewModel);
  const text = buildPlainTextFallback(viewModel);

  return {
    subject: `${ALERT_EMAIL_SUBJECT_PREFIX}: ${viewModel.headline}`,
    html,
    text,
  };
};
