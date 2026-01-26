/**
 * /api/config handlers
 * GET and PUT operations for global configuration
 */

import type { Env } from '../types';

export async function handleGetConfig(
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM config WHERE id = 1').first();
  return new Response(JSON.stringify(result), { headers });
}

export async function handleUpdateConfig(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const body = await request.json() as { interval_min: number };

  if (!body.interval_min || body.interval_min < 5) {
    return new Response(
      JSON.stringify({ error: 'interval_min must be at least 5 minutes' }),
      { status: 400, headers }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(`
    UPDATE config SET interval_min = ?, updated_at = ? WHERE id = 1
    RETURNING *
  `).bind(body.interval_min, now).first();

  return new Response(JSON.stringify(result), { headers });
}
