/**
 * Ranking Calculator
 * Calculates state rankings based on uptime, latency, and issue resolution
 */

import type { Env, RankingPeriod } from '../types';

interface StateMetrics {
  state: string;
  uptime_percentage: number;
  avg_latency_ms: number | null;
  issue_resolution_rate: number;
  portal_coverage: number;
  total_portals: number;
  total_checks: number;
  total_issues: number;
  resolved_issues: number;
}

interface MethodologyWeights {
  uptime_weight: number;
  latency_weight: number;
  issue_resolution_weight: number;
  coverage_weight: number;
}

/**
 * Get period boundaries for ranking calculation
 */
function getPeriodBoundaries(period: RankingPeriod, now: Date): { start: number; end: number } {
  const endTime = Math.floor(now.getTime() / 1000);
  let startTime: number;

  switch (period) {
    case 'weekly':
      startTime = endTime - 7 * 24 * 60 * 60;
      break;
    case 'monthly':
      startTime = endTime - 30 * 24 * 60 * 60;
      break;
    case 'quarterly':
      startTime = endTime - 90 * 24 * 60 * 60;
      break;
    case 'yearly':
      startTime = endTime - 365 * 24 * 60 * 60;
      break;
  }

  return { start: startTime, end: endTime };
}

/**
 * Calculate ranking score based on methodology weights
 */
function calculateScore(metrics: StateMetrics, weights: MethodologyWeights, maxPortals: number): number {
  // Uptime score (0-100)
  const uptimeScore = metrics.uptime_percentage;

  // Latency score (0-100, lower is better)
  // Score = 100 - (avg_latency / 100), capped between 0-100
  const latencyScore = metrics.avg_latency_ms
    ? Math.max(0, Math.min(100, 100 - (metrics.avg_latency_ms / 100)))
    : 50; // Default if no latency data

  // Issue resolution score (0-100)
  const resolutionScore = metrics.issue_resolution_rate;

  // Coverage score (0-100, normalized against max)
  const coverageScore = maxPortals > 0
    ? (metrics.total_portals / maxPortals) * 100
    : 0;

  // Calculate weighted score
  const score =
    (uptimeScore * weights.uptime_weight) +
    (latencyScore * weights.latency_weight) +
    (resolutionScore * weights.issue_resolution_weight) +
    (coverageScore * weights.coverage_weight);

  return Math.round(score * 100) / 100;
}

/**
 * Get state metrics for ranking calculation
 */
async function getStateMetrics(db: D1Database, startTime: number, endTime: number): Promise<StateMetrics[]> {
  // Get uptime and latency metrics
  const uptimeMetrics = await db.prepare(
    `SELECT
      t.state,
      COUNT(c.id) as total_checks,
      SUM(CASE WHEN c.ok = 1 THEN 1 ELSE 0 END) as successful_checks,
      ROUND(100.0 * SUM(CASE WHEN c.ok = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(c.id), 0), 2) as uptime_percentage,
      AVG(CASE WHEN c.ok = 1 THEN c.latency_ms END) as avg_latency_ms,
      COUNT(DISTINCT t.id) as total_portals
    FROM targets t
    LEFT JOIN checks c ON t.id = c.target_id AND c.ts >= ? AND c.ts <= ?
    WHERE t.state IS NOT NULL AND t.enabled = 1
    GROUP BY t.state`
  ).bind(startTime, endTime).all<{
    state: string;
    total_checks: number;
    successful_checks: number;
    uptime_percentage: number;
    avg_latency_ms: number | null;
    total_portals: number;
  }>();

  // Get issue resolution metrics
  const issueMetrics = await db.prepare(
    `SELECT
      t.state,
      COUNT(i.id) as total_issues,
      SUM(CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END) as resolved_issues
    FROM targets t
    LEFT JOIN issues i ON t.id = i.target_id AND i.created_at >= ? AND i.created_at <= ?
    WHERE t.state IS NOT NULL
    GROUP BY t.state`
  ).bind(startTime, endTime).all<{
    state: string;
    total_issues: number;
    resolved_issues: number;
  }>();

  // Create issue lookup map
  const issueMap = new Map<string, { total: number; resolved: number }>();
  (issueMetrics.results || []).forEach(m => {
    issueMap.set(m.state, { total: m.total_issues, resolved: m.resolved_issues });
  });

  // Combine metrics
  return (uptimeMetrics.results || []).map(u => {
    const issues = issueMap.get(u.state) || { total: 0, resolved: 0 };
    const resolutionRate = issues.total > 0
      ? Math.round((issues.resolved / issues.total) * 100 * 100) / 100
      : 100; // 100% if no issues

    return {
      state: u.state,
      uptime_percentage: u.uptime_percentage || 0,
      avg_latency_ms: u.avg_latency_ms,
      issue_resolution_rate: resolutionRate,
      portal_coverage: u.total_portals,
      total_portals: u.total_portals,
      total_checks: u.total_checks,
      total_issues: issues.total,
      resolved_issues: issues.resolved
    };
  });
}

/**
 * Get current methodology weights
 */
async function getMethodologyWeights(db: D1Database): Promise<MethodologyWeights> {
  const methodology = await db.prepare(
    `SELECT uptime_weight, latency_weight, issue_resolution_weight, coverage_weight
     FROM ranking_methodology
     WHERE effective_from <= ?
     ORDER BY version DESC
     LIMIT 1`
  ).bind(Math.floor(Date.now() / 1000)).first<MethodologyWeights>();

  return methodology || {
    uptime_weight: 0.5,
    latency_weight: 0.2,
    issue_resolution_weight: 0.2,
    coverage_weight: 0.1
  };
}

/**
 * Get previous rankings for rank change calculation
 */
async function getPreviousRankings(db: D1Database, period: RankingPeriod): Promise<Map<string, number>> {
  const previous = await db.prepare(
    `SELECT state, rank
     FROM state_rankings
     WHERE period = ?
     ORDER BY period_end DESC`
  ).bind(period).all<{ state: string; rank: number }>();

  const rankMap = new Map<string, number>();
  (previous.results || []).forEach(r => {
    if (!rankMap.has(r.state)) {
      rankMap.set(r.state, r.rank);
    }
  });

  return rankMap;
}

/**
 * Calculate and store rankings for a period
 */
export async function calculateRankings(
  period: RankingPeriod,
  db: D1Database,
  env: Env
): Promise<{ calculated: number; errors: number }> {
  const now = new Date();
  const { start, end } = getPeriodBoundaries(period, now);

  try {
    // Get methodology weights
    const weights = await getMethodologyWeights(db);

    // Get state metrics
    const metrics = await getStateMetrics(db, start, end);

    if (metrics.length === 0) {
      console.log(`No states found for ${period} ranking`);
      return { calculated: 0, errors: 0 };
    }

    // Get max portals for coverage normalization
    const maxPortals = Math.max(...metrics.map(m => m.total_portals));

    // Get previous rankings
    const previousRanks = await getPreviousRankings(db, period);

    // Calculate scores and sort
    const scoredMetrics = metrics.map(m => ({
      ...m,
      score: calculateScore(m, weights, maxPortals)
    })).sort((a, b) => b.score - a.score);

    // Assign ranks and calculate changes
    const rankedMetrics = scoredMetrics.map((m, idx) => {
      const rank = idx + 1;
      const previousRank = previousRanks.get(m.state) || null;
      const rankChange = previousRank ? previousRank - rank : 0;

      return { ...m, rank, previous_rank: previousRank, rank_change: rankChange };
    });

    // Store rankings
    const insertStmt = db.prepare(
      `INSERT INTO state_rankings (
        state, period, period_start, period_end, rank, previous_rank, rank_change,
        score, uptime_percentage, avg_latency_ms, issue_resolution_rate,
        portal_coverage, total_portals, total_checks, total_issues, resolved_issues,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let calculated = 0;
    let errors = 0;
    const createdAt = Math.floor(Date.now() / 1000);

    for (const m of rankedMetrics) {
      try {
        await insertStmt.bind(
          m.state,
          period,
          start,
          end,
          m.rank,
          m.previous_rank,
          m.rank_change,
          m.score,
          m.uptime_percentage,
          m.avg_latency_ms,
          m.issue_resolution_rate,
          m.portal_coverage,
          m.total_portals,
          m.total_checks,
          m.total_issues,
          m.resolved_issues,
          createdAt
        ).run();
        calculated++;
      } catch (err) {
        console.error(`Error storing ranking for ${m.state}:`, err);
        errors++;
      }
    }

    console.log(`${period} rankings: ${calculated} calculated, ${errors} errors`);
    return { calculated, errors };

  } catch (error) {
    console.error(`Error calculating ${period} rankings:`, error);
    return { calculated: 0, errors: 1 };
  }
}

/**
 * Run ranking calculations based on schedule
 * Called from scheduled trigger
 */
export async function runScheduledRankings(env: Env): Promise<void> {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const dayOfMonth = now.getUTCDate();
  const month = now.getUTCMonth();
  const hour = now.getUTCHours();

  // Only run at specific times (2 AM UTC)
  if (hour !== 2) return;

  // Weekly rankings on Sunday
  if (dayOfWeek === 0) {
    await calculateRankings('weekly', env.DB, env);
  }

  // Monthly rankings on the 1st
  if (dayOfMonth === 1) {
    await calculateRankings('monthly', env.DB, env);

    // Quarterly rankings on Jan 1, Apr 1, Jul 1, Oct 1
    if ([0, 3, 6, 9].includes(month)) {
      await calculateRankings('quarterly', env.DB, env);
    }

    // Yearly rankings on Jan 1
    if (month === 0) {
      await calculateRankings('yearly', env.DB, env);
    }
  }
}
