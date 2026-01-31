/**
 * GET /api/state-daily handler
 * Returns daily uptime data for a specific state
 */

import type { Env } from '../types';
import { TIME_WINDOWS } from '../constants';

interface DailyUptimeRecord {
  date: string;
  total_targets: number;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  uptime_percentage: number;
  avg_latency_ms: number | null;
}

interface StateTargetStats {
  id: number;
  name: string;
  hostname: string;
  total_checks: number;
  successful_checks: number;
  uptime_percentage: number;
  avg_latency_ms: number | null;
  last_check_ok: number | null;
  last_check_ts: number | null;
}

export async function handleGetStateDailyUptime(
  env: Env,
  state: string | null,
  window: string,
  headers: Record<string, string>
): Promise<Response> {
  if (!state) {
    return new Response(
      JSON.stringify({ error: 'State parameter is required' }),
      { status: 400, headers }
    );
  }

  const windowSeconds = TIME_WINDOWS[window as keyof typeof TIME_WINDOWS] || TIME_WINDOWS['7d'];
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - windowSeconds;

  // Get daily uptime breakdown for the state
  const dailyQuery = `
    WITH daily_checks AS (
      SELECT
        date(c.ts, 'unixepoch') as check_date,
        t.id as target_id,
        c.ok,
        c.latency_ms
      FROM checks c
      JOIN targets t ON c.target_id = t.id
      WHERE t.state = ? AND c.ts >= ?
    )
    SELECT
      check_date as date,
      COUNT(DISTINCT target_id) as total_targets,
      COUNT(*) as total_checks,
      SUM(ok) as successful_checks,
      COUNT(*) - SUM(ok) as failed_checks,
      ROUND(AVG(ok) * 100, 2) as uptime_percentage,
      ROUND(AVG(CASE WHEN ok = 1 THEN latency_ms END), 0) as avg_latency_ms
    FROM daily_checks
    GROUP BY check_date
    ORDER BY check_date DESC
  `;

  const dailyResult = await env.DB.prepare(dailyQuery)
    .bind(state, startTime)
    .all<DailyUptimeRecord>();

  // Get per-target stats for the state
  const targetsQuery = `
    WITH target_stats AS (
      SELECT
        t.id,
        t.name,
        t.hostname,
        COUNT(c.id) as total_checks,
        SUM(c.ok) as successful_checks,
        ROUND(AVG(c.ok) * 100, 2) as uptime_percentage,
        ROUND(AVG(CASE WHEN c.ok = 1 THEN c.latency_ms END), 0) as avg_latency_ms
      FROM targets t
      LEFT JOIN checks c ON t.id = c.target_id AND c.ts >= ?
      WHERE t.state = ? AND t.enabled = 1
      GROUP BY t.id
    ),
    latest_checks AS (
      SELECT
        target_id,
        ok as last_check_ok,
        ts as last_check_ts,
        ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY ts DESC) as rn
      FROM checks
    )
    SELECT
      ts.id,
      ts.name,
      ts.hostname,
      ts.total_checks,
      ts.successful_checks,
      ts.uptime_percentage,
      ts.avg_latency_ms,
      lc.last_check_ok,
      lc.last_check_ts
    FROM target_stats ts
    LEFT JOIN latest_checks lc ON ts.id = lc.target_id AND lc.rn = 1
    ORDER BY ts.uptime_percentage ASC, ts.name ASC
  `;

  const targetsResult = await env.DB.prepare(targetsQuery)
    .bind(startTime, state)
    .all<StateTargetStats>();

  return new Response(
    JSON.stringify({
      state,
      window,
      daily: dailyResult.results || [],
      targets: targetsResult.results || [],
    }),
    { headers }
  );
}

export async function handleGetTenderSites(
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  // Get all tender sites grouped by state with current status
  const query = `
    WITH latest AS (
      SELECT
        target_id,
        ok,
        ts,
        latency_ms,
        ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY ts DESC) as rn
      FROM checks
    )
    SELECT
      t.id,
      t.name,
      t.url,
      t.hostname,
      t.state,
      t.enabled,
      l.ok as last_ok,
      l.ts as last_ts,
      l.latency_ms as last_latency_ms
    FROM targets t
    LEFT JOIN latest l ON t.id = l.target_id AND l.rn = 1
    WHERE t.name LIKE '%tender%'
       OR t.name LIKE '%Tender%'
       OR t.name LIKE '%eProcurement%'
       OR t.name LIKE '%e-Procurement%'
       OR t.url LIKE '%tender%'
       OR t.url LIKE '%eprocure%'
    ORDER BY t.state, t.name
  `;

  const result = await env.DB.prepare(query).all();

  return new Response(
    JSON.stringify(result.results || []),
    { headers }
  );
}
