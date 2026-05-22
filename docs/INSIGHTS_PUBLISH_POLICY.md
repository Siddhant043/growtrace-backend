# Insights publish policy (LLM cost control)

GrowTrace generates AI insights (platform, content, trend, audience, recommendation) in **one LangGraph workflow run per publish** in `insights-ms`. The server gates how often snapshots are sent to RabbitMQ.

## Schedule

| Setting | Default | Meaning |
| -------- | ------- | ------- |
| `INSIGHTS_PUBLISH_CRON` | `0 9,21 * * *` | BullMQ scheduler runs at **09:00** and **21:00 UTC** |
| `INSIGHTS_PUBLISH_MAX_PER_UTC_DAY` | `2` | At most **two publishes per user per UTC calendar day** |

Together, each Pro user gets at most **two full insight batches per UTC day**, aligned with the twice-daily cron.

## Policy order (`evaluateInsightPublishPolicy`)

1. `skip_below_min_link_clicks` — below `INSIGHTS_PUBLISH_MIN_LINK_CLICKS`
2. `skip_daily_publish_cap` — `publishCountForUtcDay` for current UTC day ≥ max
3. Allow `publish_first_time` / `publish_content_changed` (if under cap)
4. Same hash: `publish_force_refresh` after `INSIGHTS_PUBLISH_FORCE_REFRESH_MS` (if under cap)
5. `skip_content_dedupe_ttl` / `skip_min_interval` for unchanged snapshots
6. `skip_content_unchanged` when hash unchanged and not force-refresh eligible

Mid-day analytics changes **do not** trigger extra LLM runs until the next cron slot if the daily cap is used.

## Related env vars

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `INSIGHTS_PUBLISH_MIN_INTERVAL_MS` | `43200000` (12h) | Minimum time between publishes (matches cron spacing) |
| `INSIGHTS_PUBLISH_CONTENT_DEDUPE_TTL_MS` | `43200000` (12h) | Block republishing identical snapshot hash |
| `INSIGHTS_PUBLISH_FORCE_REFRESH_MS` | `86400000` (24h) | Allow one refresh with unchanged hash (still capped per day) |
| `INSIGHTS_PUBLISH_MIN_LINK_CLICKS` | `0` | Minimum link clicks before publishing |

## Cursor fields (`insight_publish_cursors`)

- `publishUtcDayKey` — e.g. `2026-05-23`
- `publishCountForUtcDay` — increments on each successful publish that day

## Product UX

The Pro insights UI may show new AI insights at most **twice per UTC day** under default settings.

## Deploy checklist

1. Set `INSIGHTS_PUBLISH_CRON=0 9,21 * * *` in production `.env` if overriding defaults.
2. Restart the backend so BullMQ `upsertJobScheduler` picks up the cron pattern.
3. Confirm in logs: `insightsPublish scheduled (cron='0 9,21 * * *')`.
4. Monitor `publish skipped by policy` with reason `skip_daily_publish_cap`.
5. **insights-ms** does not need a redeploy for this change.

## Admin retry

Retrying a **failed** insight job from the admin API re-publishes to RabbitMQ and does **not** update the publish cursor. Use only for ops recovery.
