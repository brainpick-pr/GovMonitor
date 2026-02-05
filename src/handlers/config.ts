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
  const body = await request.json() as { interval_min: number; changed_by?: string; reason?: string };

  if (!body.interval_min || body.interval_min < 5) {
    return new Response(
      JSON.stringify({ error: 'interval_min must be at least 5 minutes' }),
      { status: 400, headers }
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // Get the current value before updating
  const currentConfig = await env.DB.prepare('SELECT * FROM config WHERE id = 1').first<{
    id: number;
    interval_min: number;
    last_run_at: number | null;
    created_at: number;
    updated_at: number;
  }>();

  if (!currentConfig) {
    return new Response(
      JSON.stringify({ error: 'Config not found' }),
      { status: 404, headers }
    );
  }

  // Only log if the value actually changed
  if (currentConfig.interval_min !== body.interval_min) {
    // Log the change to config_history
    await env.DB.prepare(`
      INSERT INTO config_history (field_name, old_value, new_value, changed_by, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      'interval_min',
      currentConfig.interval_min.toString(),
      body.interval_min.toString(),
      body.changed_by || 'api',
      body.reason || null,
      now
    ).run();
  }

  // Update the config
  const result = await env.DB.prepare(`
    UPDATE config SET interval_min = ?, updated_at = ? WHERE id = 1
    RETURNING *
  `).bind(body.interval_min, now).first();

  return new Response(JSON.stringify(result), { headers });
}
