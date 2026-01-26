/**
 * Main health check logic
 */

import type { Env, Target, CheckResult } from '../types';
import { invalidateStatusCache } from '../utils/cache';
import { checkWebsite } from './modes/website';
import { checkApiJson } from './modes/api-json';
import { checkApiText } from './modes/api-text';

export async function checkTarget(target: Target, env: Env): Promise<CheckResult | null> {
  const startTime = Date.now();
  const timeout = parseInt(env.TIMEOUT_MS || '5000');
  const userAgent = env.USER_AGENT || 'GovMonitorBot/1.0';

  let result: CheckResult;

  try {
    // Route to appropriate check mode
    switch (target.check_mode) {
      case 'website':
        result = await checkWebsite(target, { timeout, userAgent });
        break;
      case 'api-json':
        result = await checkApiJson(target, { timeout, userAgent });
        break;
      case 'api-text':
        result = await checkApiText(target, { timeout, userAgent });
        break;
      default:
        throw new Error(`Unknown check mode: ${target.check_mode}`);
    }

    // Log structured output for Logpush
    console.log(JSON.stringify({
      event: 'health_check',
      target_id: target.id,
      target_name: target.name,
      url: target.url,
      check_mode: target.check_mode,
      status: result.status,
      latency_ms: result.latency_ms,
      ok: result.ok,
      validation_details: result.validation_details,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    const latency = Date.now() - startTime;
    result = {
      ok: false,
      latency_ms: latency,
      error: (error as Error).message,
    };

    console.log(JSON.stringify({
      event: 'health_check_error',
      target_id: target.id,
      target_name: target.name,
      url: target.url,
      error: (error as Error).message,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    }));
  }

  // Store result in D1
  const now = Math.floor(Date.now() / 1000);
  const checkInsertResult = await env.DB.prepare(`
    INSERT INTO checks (target_id, ts, ok, status, latency_ms, error)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(
    target.id,
    now,
    result.ok ? 1 : 0,
    result.status || null,
    result.latency_ms || null,
    result.error || null
  ).first<{ id: number }>();

  const checkId = checkInsertResult?.id || 0;

  // Detect and dispatch alerts
  const { detectAlerts, getPreviousCheck, getAlertConfig } = await import('../alerts/detector');
  const { dispatchAlerts } = await import('../alerts/dispatcher');

  try {
    const alertConfig = await getAlertConfig(target.id, env.DB);

    if (alertConfig?.enabled) {
      const previousCheck = await getPreviousCheck(target.id, env.DB);
      const alerts = await detectAlerts(target, result, previousCheck, alertConfig, env.DB);

      if (alerts.length > 0) {
        console.log(`Detected ${alerts.length} alert(s) for ${target.name}`);
        await dispatchAlerts(alerts, target, checkId, env.DB, env);
      }
    }
  } catch (error) {
    console.error('Alert processing error:', error);
    // Don't fail the check if alerts fail
  }

  // Update next check time
  const nextCheck = now + (target.interval_min * 60);
  await env.DB.prepare(
    'UPDATE targets SET next_check_at = ?, updated_at = ? WHERE id = ?'
  ).bind(nextCheck, now, target.id).run();

  // Invalidate KV cache
  await invalidateStatusCache(env.KV);

  console.log(`✓ Checked ${target.url}: ${result.ok ? 'UP' : 'DOWN'} (${result.latency_ms}ms)`);

  return result;
}
