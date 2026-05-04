import type {
  WeeklyReportInsightEntry,
  WeeklyReportPayload,
  WeeklyReportRecommendationEntry,
  WeeklyReportTrendBucket,
} from "../services/weeklyReportGenerator.service.js";

export type WeeklyReportEmailViewModel = {
  payload: WeeklyReportPayload;
  webBaseUrl: string;
};

export type BuiltWeeklyReportEmail = {
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

const formatNumber = (value: number, fractionDigits = 0): string => {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const formatSignedPercent = (deltaPct: number): string => {
  const rounded = Math.round(Math.abs(deltaPct));
  if (deltaPct > 0) {
    return `+${rounded}%`;
  }
  if (deltaPct < 0) {
    return `-${rounded}%`;
  }
  return "0%";
};

const formatDateRangeLabel = (weekStart: Date, weekEnd: Date): string => {
  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${monthFormatter.format(weekStart)} – ${monthFormatter.format(weekEnd)}`;
};

const buildSparklineMarkup = (
  trends: readonly WeeklyReportTrendBucket[],
): string => {
  if (trends.length === 0) {
    return "";
  }

  const peakClicks = Math.max(...trends.map((bucket) => bucket.clicks), 1);
  const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "narrow",
    timeZone: "UTC",
  });

  const cells = trends
    .map((bucket) => {
      const heightPct = Math.max((bucket.clicks / peakClicks) * 100, 4);
      const dayLabel = dayLabelFormatter.format(bucket.date);
      return `
        <td align="center" valign="bottom" style="padding:0 4px;">
          <div style="height:84px;display:flex;align-items:flex-end;justify-content:center;">
            <div style="width:14px;height:${heightPct.toFixed(1)}%;background:linear-gradient(180deg,#7c3aed,#4f46e5);border-radius:6px;"></div>
          </div>
          <div style="margin-top:6px;font-size:11px;color:#6b7280;font-weight:600;letter-spacing:0.06em;">${escapeHtml(dayLabel)}</div>
          <div style="font-size:10px;color:#9ca3af;font-weight:600;">${escapeHtml(formatNumber(bucket.clicks))}</div>
        </td>
      `;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
      <tr>${cells}</tr>
    </table>
  `;
};

const buildKpiCardMarkup = (
  label: string,
  primaryValue: string,
  deltaLabel: string | null,
  isPositive: boolean,
): string => {
  const deltaColor = isPositive ? "#15803d" : "#b91c1c";
  const deltaArrow = isPositive ? "&#x25B2;" : "&#x25BC;";
  const deltaMarkup = deltaLabel
    ? `<div style="margin-top:6px;font-size:12px;font-weight:700;color:${deltaColor};letter-spacing:0.04em;">${deltaArrow} ${escapeHtml(deltaLabel)}</div>`
    : "";

  return `
    <td align="left" valign="top" style="padding:8px;">
      <div style="border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;padding:14px 16px;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
        <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.12em;">${escapeHtml(label)}</div>
        <div style="margin-top:4px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.1;">${escapeHtml(primaryValue)}</div>
        ${deltaMarkup}
      </div>
    </td>
  `;
};

const buildBulletproofCtaButton = (
  href: string,
  label: string,
): string => {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;">
      <tr>
        <td align="center" bgcolor="#4f46e5" style="border-radius:14px;">
          <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="20%" stroke="f" fillcolor="#4f46e5">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center>
            </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="${safeHref}" style="display:inline-block;padding:14px 28px;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;background:linear-gradient(135deg,#6366f1,#7c3aed);">
            ${safeLabel}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;
};

const buildInsightHighlightSection = (
  heroInsight: WeeklyReportInsightEntry | null,
): string => {
  if (!heroInsight) {
    return "";
  }
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr>
        <td style="padding:18px 20px;border-radius:18px;background:linear-gradient(135deg,#eef2ff,#fdf4ff);border:1px solid #e0e7ff;">
          <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.14em;">Key Insight</div>
          <div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;line-height:1.4;">${escapeHtml(heroInsight.message)}</div>
        </td>
      </tr>
    </table>
  `;
};

const buildRecommendationsSection = (
  recommendations: readonly WeeklyReportRecommendationEntry[],
): string => {
  if (recommendations.length === 0) {
    return "";
  }

  const visibleRecommendations = recommendations.slice(0, 2);
  const items = visibleRecommendations
    .map(
      (entry) => `
        <li style="margin:0 0 10px;padding:0;line-height:1.5;color:#1f2937;font-size:14px;">
          <span style="color:#6366f1;font-weight:800;margin-right:6px;">&#x2192;</span>${escapeHtml(entry.message)}
        </li>
      `,
    )
    .join("");

  return `
    <div style="margin-top:24px;">
      <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.14em;">Recommendations</div>
      <ul style="margin:8px 0 0;padding-left:0;list-style:none;">${items}</ul>
    </div>
  `;
};

const buildPlainTextFallback = (payload: WeeklyReportPayload): string => {
  const lines: string[] = [];
  lines.push(payload.summary.headline);
  lines.push("");
  lines.push(`Week: ${formatDateRangeLabel(payload.weekStart, payload.weekEnd)}`);
  lines.push(`Engagement delta: ${formatSignedPercent(payload.summary.deltaPct)}`);
  lines.push(`Clicks: ${formatNumber(payload.totalClicks)}`);
  lines.push(`Sessions: ${formatNumber(payload.totalSessions)}`);

  if (payload.topPlatform.platform) {
    lines.push("");
    lines.push(
      `Top platform: ${payload.topPlatform.platform} (${formatNumber(payload.topPlatform.clicks)} clicks)`,
    );
  }
  if (payload.topContent.shortCode) {
    lines.push(
      `Top content: ${payload.topContent.shortCode} (${formatNumber(payload.topContent.clicks)} clicks)`,
    );
  }

  const heroInsight = payload.insights[0] ?? null;
  if (heroInsight) {
    lines.push("");
    lines.push(`Key insight: ${heroInsight.message}`);
  }

  if (payload.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    payload.recommendations.slice(0, 2).forEach((entry) => {
      lines.push(`  - ${entry.message}`);
    });
  }

  return lines.join("\n");
};

const buildHtmlBody = (
  payload: WeeklyReportPayload,
  webBaseUrl: string,
): string => {
  const dateRangeLabel = formatDateRangeLabel(
    payload.weekStart,
    payload.weekEnd,
  );

  const ctaHref = `${webBaseUrl.replace(/\/$/, "")}/reports/${payload.weekStart.toISOString().slice(0, 10)}`;

  const engagementAverage =
    payload.totalSessions > 0
      ? payload.trends.reduce(
          (runningSum, bucket) =>
            runningSum + bucket.engagementScore * bucket.clicks,
          0,
        ) / Math.max(payload.totalClicks, 1)
      : 0;

  const kpiRow = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
      <tr>
        ${buildKpiCardMarkup(
          "Engagement",
          formatNumber(engagementAverage, 1),
          formatSignedPercent(payload.summary.deltaPct),
          payload.summary.deltaPct >= 0,
        )}
        ${buildKpiCardMarkup(
          "Clicks",
          formatNumber(payload.totalClicks),
          null,
          true,
        )}
        ${buildKpiCardMarkup(
          "Sessions",
          formatNumber(payload.totalSessions),
          null,
          true,
        )}
      </tr>
    </table>
  `;

  const topPlatformCard = payload.topPlatform.platform
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr>
          <td style="padding:18px 20px;border-radius:18px;border:1px solid #e5e7eb;background:#ffffff;">
            <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.14em;">Top Platform</div>
            <div style="margin-top:6px;font-size:20px;font-weight:800;color:#0f172a;text-transform:capitalize;">${escapeHtml(payload.topPlatform.platform)}</div>
            <div style="margin-top:4px;font-size:13px;color:#6b7280;font-weight:500;">${formatNumber(payload.topPlatform.clicks)} clicks &middot; ${formatNumber(payload.topPlatform.engagementScore, 1)} engagement</div>
          </td>
        </tr>
      </table>
    `
    : "";

  const topContentCard = payload.topContent.shortCode
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
        <tr>
          <td style="padding:18px 20px;border-radius:18px;border:1px solid #e5e7eb;background:#ffffff;">
            <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.14em;">Top Content</div>
            <div style="margin-top:6px;font-size:20px;font-weight:800;color:#0f172a;font-family:Menlo,Consolas,monospace;">${escapeHtml(payload.topContent.shortCode)}</div>
            <div style="margin-top:4px;font-size:13px;color:#6b7280;font-weight:500;">${formatNumber(payload.topContent.clicks)} clicks &middot; ${formatNumber(payload.topContent.engagementScore, 1)} engagement</div>
          </td>
        </tr>
      </table>
    `
    : "";

  const sparklineSection = payload.trends.length
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr>
          <td style="padding:18px 20px;border-radius:18px;border:1px solid #e5e7eb;background:#ffffff;">
            <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.14em;">7-Day Trend</div>
            ${buildSparklineMarkup(payload.trends)}
          </td>
        </tr>
      </table>
    `
    : "";

  const heroInsight: WeeklyReportInsightEntry | null = payload.insights[0] ?? null;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>${escapeHtml(payload.summary.headline)}</title>
        <style>
          @media (prefers-color-scheme: dark) {
            body, table, td { background:#0b1020 !important; color:#f3f4f6 !important; }
            .gt-card { background:#111827 !important; border-color:#1f2937 !important; }
            .gt-muted { color:#9ca3af !important; }
            .gt-headline { color:#ffffff !important; }
          }
          @media only screen and (max-width: 600px) {
            .gt-container { width:100% !important; padding:16px !important; }
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
                    <div style="font-size:11px;font-weight:800;color:#6366f1;letter-spacing:0.18em;text-transform:uppercase;">GrowTrace &middot; Weekly Report</div>
                    <div class="gt-muted" style="margin-top:4px;font-size:12px;color:#6b7280;font-weight:600;letter-spacing:0.06em;">WEEK OF ${escapeHtml(dateRangeLabel.toUpperCase())}</div>
                    <h1 class="gt-headline" style="margin:14px 0 0;font-size:28px;line-height:1.2;letter-spacing:-0.01em;color:#0f172a;font-weight:800;">${escapeHtml(payload.summary.headline)}</h1>
                  </td>
                </tr>
                <tr>
                  <td>${kpiRow}</td>
                </tr>
                <tr>
                  <td>${topPlatformCard}</td>
                </tr>
                <tr>
                  <td>${topContentCard}</td>
                </tr>
                <tr>
                  <td>${sparklineSection}</td>
                </tr>
                <tr>
                  <td>${buildInsightHighlightSection(heroInsight)}</td>
                </tr>
                <tr>
                  <td>${buildRecommendationsSection(payload.recommendations)}</td>
                </tr>
                <tr>
                  <td align="center">${buildBulletproofCtaButton(ctaHref, payload.ctaLabel || "View full report")}</td>
                </tr>
                <tr>
                  <td style="padding-top:28px;border-top:1px solid #e5e7eb;margin-top:28px;">
                    <div style="font-size:11px;color:#9ca3af;line-height:1.6;text-align:center;">
                      You are receiving this because weekly reports are enabled on your GrowTrace account.<br />
                      <a href="${escapeHtml(webBaseUrl)}/settings" style="color:#6366f1;text-decoration:none;font-weight:600;">Manage email preferences</a>
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

export const buildWeeklyReportEmail = (
  viewModel: WeeklyReportEmailViewModel,
): BuiltWeeklyReportEmail => {
  const html = buildHtmlBody(viewModel.payload, viewModel.webBaseUrl);
  const text = buildPlainTextFallback(viewModel.payload);

  return {
    subject: viewModel.payload.emailSubject || "Your weekly GrowTrace report",
    html,
    text,
  };
};
