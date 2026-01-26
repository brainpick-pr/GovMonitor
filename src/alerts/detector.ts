/**
 * Alert detection logic
 * Analyzes check results and determines if alerts should be triggered
 */

import type { Target, CheckResult, AlertConfig, AlertCondition } from '../types';

export async function detectAlerts(
  target: Target,
  checkResult: CheckResult,
  previousCheck: CheckResult | null,
  config: AlertConfig,
  db: D1Database
): Promise<AlertCondition[]> {
  const alerts: AlertCondition[] = [];

  // 1. Downtime Alert - Target went from UP to DOWN
  if (previousCheck?.ok && !checkResult.ok && config.downtime_alerts) {
    alerts.push({
      type: 'downtime',
      severity: 'high',
      shouldTrigger: true,
      message: `${target.name} (${target.state}) is DOWN`,
      metadata: {
        url: target.url,
        status: checkResult.status,
        error: checkResult.error,
        previous_status: previousCheck.status,
      }
    });
  }

  // 2. Recovery Alert - Target went from DOWN to UP
  if (!previousCheck?.ok && checkResult.ok && config.recovery_alerts) {
    alerts.push({
      type: 'recovery',
      severity: 'info',
      shouldTrigger: true,
      message: `${target.name} (${target.state}) has RECOVERED`,
      metadata: {
        url: target.url,
        status: checkResult.status,
      }
    });
  }

  // 3. Latency Alert - Response time exceeds threshold
  if (
    checkResult.ok &&
    checkResult.latency_ms &&
    checkResult.latency_ms > config.latency_threshold_ms &&
    config.latency_alerts
  ) {
    alerts.push({
      type: 'latency',
      severity: 'medium',
      shouldTrigger: true,
      message: `${target.name} - High latency: ${checkResult.latency_ms}ms (threshold: ${config.latency_threshold_ms}ms)`,
      metadata: {
        url: target.url,
        latency_ms: checkResult.latency_ms,
        threshold_ms: config.latency_threshold_ms,
      }
    });
  }

  // 4. Consecutive Failures Alert - Multiple failures in a row
  if (!checkResult.ok) {
    const recentChecks = await db.prepare(`
      SELECT ok FROM checks
      WHERE target_id = ?
      ORDER BY ts DESC
      LIMIT ?
    `).bind(target.id, config.consecutive_failures_threshold).all();

    if (recentChecks.results && recentChecks.results.length === config.consecutive_failures_threshold) {
      const allFailed = recentChecks.results.every((c: any) => c.ok === 0);

      if (allFailed) {
        alerts.push({
          type: 'consecutive_failures',
          severity: 'critical',
          shouldTrigger: true,
          message: `${target.name} - ${config.consecutive_failures_threshold} consecutive failures detected`,
          metadata: {
            url: target.url,
            failure_count: config.consecutive_failures_threshold,
            last_error: checkResult.error,
          }
        });
      }
    }
  }

  return alerts;
}

/**
 * Get previous check result for a target
 */
export async function getPreviousCheck(
  targetId: number,
  db: D1Database
): Promise<CheckResult | null> {
  const result = await db.prepare(`
    SELECT ok, status, latency_ms, error
    FROM checks
    WHERE target_id = ?
    ORDER BY ts DESC
    LIMIT 1 OFFSET 1
  `).bind(targetId).first();

  if (!result) return null;

  return {
    ok: Boolean(result.ok),
    status: result.status as number,
    latency_ms: result.latency_ms as number | undefined,
    error: result.error as string | undefined,
  };
}

/**
 * Get alert configuration for a target
 */
export async function getAlertConfig(
  targetId: number,
  db: D1Database
): Promise<AlertConfig | null> {
  const config = await db.prepare(`
    SELECT * FROM alert_configs WHERE target_id = ?
  `).bind(targetId).first<AlertConfig>();

  return config || null;
}
