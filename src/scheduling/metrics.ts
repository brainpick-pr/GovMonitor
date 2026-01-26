/**
 * Smart Scheduling Metrics
 * Tracks target performance and calculates recommended intervals
 */

import {
  SchedulingMetrics,
  SmartSchedulingConfig,
  CheckResult,
} from '../types';

/**
 * Update scheduling metrics after a check completes
 */
export async function updateSchedulingMetrics(
  targetId: number,
  checkResult: CheckResult,
  db: D1Database
): Promise<void> {
  try {
    // Get current metrics or create if not exists
    const metrics = await db
      .prepare('SELECT * FROM scheduling_metrics WHERE target_id = ?')
      .bind(targetId)
      .first<SchedulingMetrics>();

    const now = Math.floor(Date.now() / 1000);

    if (!metrics) {
      // Initialize metrics for new target
      await db
        .prepare(`
          INSERT INTO scheduling_metrics (
            target_id, total_checks, successful_checks, failed_checks,
            uptime_percentage, consecutive_successes, consecutive_failures,
            avg_latency_ms, last_failure_at, current_interval_min, created_at, updated_at
          ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?,
            (SELECT interval_min FROM targets WHERE id = ?), ?, ?)
        `)
        .bind(
          targetId,
          checkResult.ok ? 1 : 0,
          checkResult.ok ? 0 : 1,
          checkResult.ok ? 100.0 : 0.0,
          checkResult.ok ? 1 : 0,
          checkResult.ok ? 0 : 1,
          checkResult.latency_ms || null,
          checkResult.ok ? null : now,
          targetId,
          now,
          now
        )
        .run();
      return;
    }

    // Update existing metrics
    const newTotalChecks = metrics.total_checks + 1;
    const newSuccessfulChecks = metrics.successful_checks + (checkResult.ok ? 1 : 0);
    const newFailedChecks = metrics.failed_checks + (checkResult.ok ? 0 : 1);
    const newUptimePercentage = (newSuccessfulChecks / newTotalChecks) * 100;

    // Update consecutive counters
    let newConsecutiveSuccesses = metrics.consecutive_successes;
    let newConsecutiveFailures = metrics.consecutive_failures;
    let newLastFailureAt = metrics.last_failure_at;

    if (checkResult.ok) {
      newConsecutiveSuccesses += 1;
      newConsecutiveFailures = 0;
    } else {
      newConsecutiveSuccesses = 0;
      newConsecutiveFailures += 1;
      newLastFailureAt = now;
    }

    // Update average latency (rolling average)
    let newAvgLatency = metrics.avg_latency_ms;
    if (checkResult.ok && checkResult.latency_ms !== undefined) {
      if (newAvgLatency === null) {
        newAvgLatency = checkResult.latency_ms;
      } else {
        // Exponential moving average (weight recent checks more)
        newAvgLatency = newAvgLatency * 0.7 + checkResult.latency_ms * 0.3;
      }
    }

    // Extract hour from timestamp for pattern tracking
    const checkHour = new Date(now * 1000).getUTCHours();

    // Update failure time pattern
    let failurePattern: Record<string, number> = {};
    if (metrics.failure_time_pattern) {
      try {
        failurePattern = JSON.parse(metrics.failure_time_pattern);
      } catch (e) {
        failurePattern = {};
      }
    }

    if (!checkResult.ok) {
      failurePattern[checkHour] = (failurePattern[checkHour] || 0) + 1;
    }

    await db
      .prepare(`
        UPDATE scheduling_metrics SET
          total_checks = ?,
          successful_checks = ?,
          failed_checks = ?,
          uptime_percentage = ?,
          consecutive_successes = ?,
          consecutive_failures = ?,
          avg_latency_ms = ?,
          last_failure_at = ?,
          failure_time_pattern = ?,
          updated_at = ?
        WHERE target_id = ?
      `)
      .bind(
        newTotalChecks,
        newSuccessfulChecks,
        newFailedChecks,
        newUptimePercentage,
        newConsecutiveSuccesses,
        newConsecutiveFailures,
        newAvgLatency,
        newLastFailureAt,
        JSON.stringify(failurePattern),
        now,
        targetId
      )
      .run();
  } catch (error) {
    console.error('Error updating scheduling metrics:', error);
    // Don't throw - metrics update failure shouldn't break check execution
  }
}

/**
 * Calculate recommended interval based on target performance
 */
export async function calculateRecommendedInterval(
  targetId: number,
  db: D1Database,
  config: SmartSchedulingConfig
): Promise<number> {
  const metrics = await db
    .prepare('SELECT * FROM scheduling_metrics WHERE target_id = ?')
    .bind(targetId)
    .first<SchedulingMetrics>();

  if (!metrics) {
    // No metrics yet, use default
    return 15;
  }

  // Need minimum checks before adjusting
  if (metrics.total_checks < config.min_checks_before_adjust) {
    return metrics.current_interval_min;
  }

  const currentInterval = metrics.current_interval_min;
  let recommendedInterval = currentInterval;

  // Rule 1: Consecutive failures trigger immediate decrease
  if (metrics.consecutive_failures >= config.consecutive_failures_trigger) {
    recommendedInterval = Math.floor(currentInterval * config.unstable_multiplier);
    recommendedInterval = Math.max(recommendedInterval, config.min_interval_min);
    return recommendedInterval;
  }

  // Rule 2: Very stable targets get longer intervals
  if (metrics.uptime_percentage >= config.stable_threshold_uptime) {
    recommendedInterval = Math.floor(currentInterval * config.stable_multiplier);
    recommendedInterval = Math.min(recommendedInterval, config.max_interval_min);
    return recommendedInterval;
  }

  // Rule 3: Unstable targets get shorter intervals
  if (metrics.uptime_percentage < config.unstable_threshold_uptime) {
    recommendedInterval = Math.floor(currentInterval * config.unstable_multiplier);
    recommendedInterval = Math.max(recommendedInterval, config.min_interval_min);
    return recommendedInterval;
  }

  // Rule 4: Gradual adjustment for targets in middle range
  if (metrics.uptime_percentage >= 97.0 && metrics.uptime_percentage < config.stable_threshold_uptime) {
    // Slight increase for good (but not excellent) uptime
    recommendedInterval = currentInterval + 5;
    recommendedInterval = Math.min(recommendedInterval, config.max_interval_min);
    return recommendedInterval;
  }

  // No change needed
  return currentInterval;
}

/**
 * Get all targets eligible for interval adjustment
 */
export async function getAdjustmentCandidates(
  db: D1Database,
  config: SmartSchedulingConfig
): Promise<Array<{ target_id: number; current_interval: number; recommended_interval: number; reason: string }>> {
  const candidates: Array<{ target_id: number; current_interval: number; recommended_interval: number; reason: string }> = [];

  // Get all active targets with metrics
  const results = await db
    .prepare(`
      SELECT
        sm.target_id,
        sm.current_interval_min,
        sm.uptime_percentage,
        sm.consecutive_failures,
        sm.total_checks,
        sm.interval_last_adjusted_at,
        t.interval_min as target_interval
      FROM scheduling_metrics sm
      JOIN targets t ON t.id = sm.target_id
      WHERE t.enabled = 1
        AND sm.total_checks >= ?
    `)
    .bind(config.min_checks_before_adjust)
    .all<{
      target_id: number;
      current_interval_min: number;
      uptime_percentage: number;
      consecutive_failures: number;
      total_checks: number;
      interval_last_adjusted_at: number | null;
      target_interval: number;
    }>();

  if (!results.results) return candidates;

  for (const row of results.results) {
    const recommended = await calculateRecommendedInterval(row.target_id, db, config);

    // Only include if there's a meaningful change (at least 5 min difference)
    if (Math.abs(recommended - row.current_interval_min) >= 5) {
      let reason = '';

      if (row.consecutive_failures >= config.consecutive_failures_trigger) {
        reason = `${row.consecutive_failures} consecutive failures - decrease interval`;
      } else if (row.uptime_percentage >= config.stable_threshold_uptime) {
        reason = `Stable ${row.uptime_percentage.toFixed(2)}% uptime - increase interval`;
      } else if (row.uptime_percentage < config.unstable_threshold_uptime) {
        reason = `Unstable ${row.uptime_percentage.toFixed(2)}% uptime - decrease interval`;
      } else {
        reason = `Gradual adjustment based on ${row.uptime_percentage.toFixed(2)}% uptime`;
      }

      candidates.push({
        target_id: row.target_id,
        current_interval: row.current_interval_min,
        recommended_interval: recommended,
        reason,
      });
    }
  }

  return candidates;
}

/**
 * Get smart scheduling configuration from database
 */
export async function getSmartSchedulingConfig(db: D1Database): Promise<SmartSchedulingConfig | null> {
  const config = await db
    .prepare('SELECT smart_scheduling_enabled, smart_scheduling_config FROM config WHERE id = 1')
    .first<{ smart_scheduling_enabled: number; smart_scheduling_config: string | null }>();

  if (!config || !config.smart_scheduling_enabled || !config.smart_scheduling_config) {
    return null;
  }

  try {
    return JSON.parse(config.smart_scheduling_config);
  } catch (e) {
    console.error('Error parsing smart scheduling config:', e);
    return null;
  }
}
