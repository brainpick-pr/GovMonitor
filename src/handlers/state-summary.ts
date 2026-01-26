/**
 * GET /api/state-summary handler
 * Returns state-level aggregation statistics
 */

import type { Env } from '../types';
import { VALID_VIEWS } from '../constants';

export async function handleGetStateSummary(
  env: Env,
  window: string,
  headers: Record<string, string>
): Promise<Response> {
  // Validate window parameter
  if (!window || !(window in VALID_VIEWS)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid window parameter. Must be one of: 24h, 7d, 30d, 365d'
      }),
      { status: 400, headers }
    );
  }

  const viewName = VALID_VIEWS[window as keyof typeof VALID_VIEWS];
  const cacheKey = `state_summary_${window}`;

  // Try KV cache first
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached), { headers });
  }

  // Query from D1 (viewName is guaranteed to be from whitelist)
  const result = await env.DB.prepare(`SELECT * FROM ${viewName} ORDER BY state`).all();
  const data = result.results || [];

  // Cache in KV for 5 minutes
  await env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });

  return new Response(JSON.stringify(data), { headers });
}
