/**
 * Alert API handlers
 * Manage alert configurations, history, and channels
 */

import type { Env, AlertConfig, AlertChannel } from '../types';

// GET /api/alerts - List alert history
export async function handleGetAlerts(
  env: Env,
  searchParams: URLSearchParams,
  headers: Record<string, string>
): Promise<Response> {
  const targetId = searchParams.get('targetId');
  const type = searchParams.get('type');
  const severity = searchParams.get('severity');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = 'SELECT ah.*, t.name as target_name FROM alert_history ah LEFT JOIN targets t ON ah.target_id = t.id WHERE 1=1';
  const bindings: any[] = [];

  if (targetId) {
    query += ' AND ah.target_id = ?';
    bindings.push(parseInt(targetId));
  }

  if (type) {
    query += ' AND ah.alert_type = ?';
    bindings.push(type);
  }

  if (severity) {
    query += ' AND ah.severity = ?';
    bindings.push(severity);
  }

  query += ' ORDER BY ah.created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...bindings).all();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM alert_history WHERE 1=1';
  const countBindings: any[] = [];

  if (targetId) {
    countQuery += ' AND target_id = ?';
    countBindings.push(parseInt(targetId));
  }

  if (type) {
    countQuery += ' AND alert_type = ?';
    countBindings.push(type);
  }

  if (severity) {
    countQuery += ' AND severity = ?';
    countBindings.push(severity);
  }

  const countResult = await env.DB.prepare(countQuery).bind(...countBindings).first<{ total: number }>();

  return new Response(JSON.stringify({
    alerts: result.results || [],
    total: countResult?.total || 0,
    limit,
    offset,
  }), { headers });
}

// GET /api/alerts/config/:targetId - Get alert configuration
export async function handleGetAlertConfig(
  env: Env,
  targetId: string,
  headers: Record<string, string>
): Promise<Response> {
  const config = await env.DB.prepare(`
    SELECT * FROM alert_configs WHERE target_id = ?
  `).bind(parseInt(targetId)).first<AlertConfig>();

  if (!config) {
    // Return default config
    const defaultConfig = {
      target_id: parseInt(targetId),
      enabled: 1,
      downtime_alerts: 1,
      recovery_alerts: 1,
      latency_threshold_ms: 2000,
      latency_alerts: 1,
      consecutive_failures_threshold: 3,
    };
    return new Response(JSON.stringify(defaultConfig), { headers });
  }

  return new Response(JSON.stringify(config), { headers });
}

// PUT /api/alerts/config/:targetId - Update alert configuration
export async function handleUpdateAlertConfig(
  request: Request,
  env: Env,
  targetId: string,
  headers: Record<string, string>
): Promise<Response> {
  const body = await request.json() as Partial<AlertConfig>;

  // Validate target exists
  const target = await env.DB.prepare('SELECT id FROM targets WHERE id = ?')
    .bind(parseInt(targetId))
    .first();

  if (!target) {
    return new Response(
      JSON.stringify({ error: 'Target not found' }),
      { status: 404, headers }
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // Check if config exists
  const existingConfig = await env.DB.prepare(
    'SELECT id FROM alert_configs WHERE target_id = ?'
  ).bind(parseInt(targetId)).first();

  if (existingConfig) {
    // Update existing config
    const fields: string[] = [];
    const values: any[] = [];

    if (body.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(body.enabled);
    }
    if (body.downtime_alerts !== undefined) {
      fields.push('downtime_alerts = ?');
      values.push(body.downtime_alerts);
    }
    if (body.recovery_alerts !== undefined) {
      fields.push('recovery_alerts = ?');
      values.push(body.recovery_alerts);
    }
    if (body.latency_threshold_ms !== undefined) {
      fields.push('latency_threshold_ms = ?');
      values.push(body.latency_threshold_ms);
    }
    if (body.latency_alerts !== undefined) {
      fields.push('latency_alerts = ?');
      values.push(body.latency_alerts);
    }
    if (body.consecutive_failures_threshold !== undefined) {
      fields.push('consecutive_failures_threshold = ?');
      values.push(body.consecutive_failures_threshold);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(parseInt(targetId));

    const result = await env.DB.prepare(`
      UPDATE alert_configs SET ${fields.join(', ')} WHERE target_id = ?
      RETURNING *
    `).bind(...values).first();

    return new Response(JSON.stringify(result), { headers });
  } else {
    // Insert new config
    const result = await env.DB.prepare(`
      INSERT INTO alert_configs (
        target_id, enabled, downtime_alerts, recovery_alerts,
        latency_threshold_ms, latency_alerts, consecutive_failures_threshold,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      parseInt(targetId),
      body.enabled ?? 1,
      body.downtime_alerts ?? 1,
      body.recovery_alerts ?? 1,
      body.latency_threshold_ms ?? 2000,
      body.latency_alerts ?? 1,
      body.consecutive_failures_threshold ?? 3,
      now,
      now
    ).first();

    return new Response(JSON.stringify(result), { status: 201, headers });
  }
}

// GET /api/alerts/channels - List alert channels
export async function handleGetAlertChannels(
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM alert_channels ORDER BY name').all();
  return new Response(JSON.stringify(result.results || []), { headers });
}

// POST /api/alerts/channels - Add alert channel
export async function handleAddAlertChannel(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const body = await request.json() as {
    name: string;
    type: 'webhook' | 'email';
    enabled?: number;
    config: Record<string, any>;
  };

  if (!body.name || !body.type || !body.config) {
    return new Response(
      JSON.stringify({ error: 'name, type, and config are required' }),
      { status: 400, headers }
    );
  }

  if (body.type !== 'webhook' && body.type !== 'email') {
    return new Response(
      JSON.stringify({ error: 'type must be webhook or email' }),
      { status: 400, headers }
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const result = await env.DB.prepare(`
    INSERT INTO alert_channels (name, type, enabled, config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(
    body.name,
    body.type,
    body.enabled ?? 1,
    JSON.stringify(body.config),
    now,
    now
  ).first();

  return new Response(JSON.stringify(result), { status: 201, headers });
}

// DELETE /api/alerts/channels/:id - Remove alert channel
export async function handleDeleteAlertChannel(
  env: Env,
  channelId: string,
  headers: Record<string, string>
): Promise<Response> {
  await env.DB.prepare('DELETE FROM alert_channels WHERE id = ?')
    .bind(parseInt(channelId))
    .run();

  return new Response(JSON.stringify({ success: true }), { headers });
}
