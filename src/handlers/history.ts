/**
 * GET /api/history handler
 * Returns check history for a specific target
 */

import type { Env } from '../types';
import { TIME_WINDOWS } from '../constants';

export async function handleGetHistory(
  env: Env,
  targetId: string | null,
  window: string,
  headers: Record<string, string>
): Promise<Response> {
  if (!targetId) {
    return new Response(
      JSON.stringify({ error: 'targetId parameter required' }),
      { status: 400, headers }
    );
  }

  const seconds = TIME_WINDOWS[window as keyof typeof TIME_WINDOWS] || TIME_WINDOWS['24h'];
  const since = Math.floor(Date.now() / 1000) - seconds;

  const result = await env.DB.prepare(`
    SELECT ts, ok, status, latency_ms, error
    FROM checks
    WHERE target_id = ? AND ts >= ?
    ORDER BY ts ASC
  `).bind(parseInt(targetId), since).all();

  return new Response(JSON.stringify(result.results || []), { headers });
}
