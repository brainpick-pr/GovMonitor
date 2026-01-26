/**
 * GET /api/status handler
 * Returns latest status for all targets
 */

import type { Env } from '../types';
import { getCachedStatus, setCachedStatus } from '../utils/cache';

export async function handleGetStatus(
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  // Try KV first for fast response
  const cached = await getCachedStatus(env.KV);
  if (cached) {
    return new Response(JSON.stringify(cached), { headers });
  }

  // Fall back to D1
  const result = await env.DB.prepare(`
    SELECT
      t.id,
      t.name,
      t.url,
      t.hostname,
      t.state,
      t.enabled,
      c.ts,
      c.ok,
      c.status,
      c.latency_ms,
      c.error
    FROM targets t
    LEFT JOIN checks c ON t.id = c.target_id
    WHERE c.id = (
      SELECT id FROM checks
      WHERE target_id = t.id
      ORDER BY ts DESC
      LIMIT 1
    )
    ORDER BY t.name
  `).all();

  const data = result.results || [];

  // Cache in KV for 60 seconds
  await setCachedStatus(env.KV, data as any, 60);

  return new Response(JSON.stringify(data), { headers });
}
