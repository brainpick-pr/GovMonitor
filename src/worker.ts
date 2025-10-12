/**
 * GovMonitor.Org - Cloudflare Worker
 * Uptime monitoring for government websites
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  USER_AGENT: string;
  TIMEOUT_MS: string;
  MAX_LATENCY_MS: string;
}

interface Target {
  id: number;
  name: string;
  url: string;
  hostname: string;
  interval_min: number;
  next_check_at: number;
  enabled: number;
}

interface CheckResult {
  ok: boolean;
  status?: number;
  latency_ms?: number;
  error?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
      if (url.pathname === '/api/status') {
        return await handleGetStatus(env, corsHeaders);
      }

      if (url.pathname === '/api/history') {
        const targetId = url.searchParams.get('targetId');
        const window = url.searchParams.get('window') || '24h';
        return await handleGetHistory(env, targetId, window, corsHeaders);
      }

      if (url.pathname === '/api/targets' && request.method === 'GET') {
        return await handleGetTargets(env, corsHeaders);
      }

      if (url.pathname === '/api/targets' && request.method === 'POST') {
        return await handleAddTarget(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/targets/') && request.method === 'DELETE') {
        const id = url.pathname.split('/')[3];
        return await handleDeleteTarget(id, env, corsHeaders);
      }

      if (url.pathname === '/api/config' && request.method === 'GET') {
        return await handleGetConfig(env, corsHeaders);
      }

      if (url.pathname === '/api/config' && request.method === 'PUT') {
        return await handleUpdateConfig(request, env, corsHeaders);
      }

      if (url.pathname === '/api/check' && request.method === 'POST') {
        return await handleManualCheck(request, env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', details: (error as Error).message }),
        { status: 500, headers: corsHeaders }
      );
    }
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    console.log('Cron trigger fired:', new Date(event.scheduledTime).toISOString());

    try {
      const now = Math.floor(Date.now() / 1000);

      // Get all targets that need checking
      const targets = await env.DB.prepare(
        'SELECT * FROM targets WHERE enabled = 1 AND next_check_at <= ?'
      ).bind(now).all<Target>();

      if (!targets.results || targets.results.length === 0) {
        console.log('No targets to check');
        return;
      }

      console.log(`Checking ${targets.results.length} targets`);

      // Check all targets in parallel
      const checks = targets.results.map(target =>
        checkTarget(target, env).catch(error => {
          console.error(`Failed to check ${target.url}:`, error);
          return null;
        })
      );

      await Promise.all(checks);

      // Update last run timestamp
      await env.DB.prepare(
        'UPDATE config SET last_run_at = ?, updated_at = ? WHERE id = 1'
      ).bind(now, now).run();

      console.log('Cron job completed successfully');
    } catch (error) {
      console.error('Cron job error:', error);
    }
  },
};

// API Handlers

async function handleGetStatus(env: Env, headers: Record<string, string>): Promise<Response> {
  // Try KV first for fast response
  const cached = await env.KV.get('latest_status', 'json');
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

  // Cache in KV for 30 seconds
  await env.KV.put('latest_status', JSON.stringify(data), { expirationTtl: 30 });

  return new Response(JSON.stringify(data), { headers });
}

async function handleGetHistory(
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

  const seconds = window === '7d' ? 604800 : 86400; // 7 days or 24 hours
  const since = Math.floor(Date.now() / 1000) - seconds;

  const result = await env.DB.prepare(`
    SELECT ts, ok, status, latency_ms, error
    FROM checks
    WHERE target_id = ? AND ts >= ?
    ORDER BY ts ASC
  `).bind(parseInt(targetId), since).all();

  return new Response(JSON.stringify(result.results || []), { headers });
}

async function handleGetTargets(env: Env, headers: Record<string, string>): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM targets ORDER BY name').all();
  return new Response(JSON.stringify(result.results || []), { headers });
}

async function handleAddTarget(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const body = await request.json() as { name: string; url: string; interval_min?: number };

  if (!body.name || !body.url) {
    return new Response(
      JSON.stringify({ error: 'name and url are required' }),
      { status: 400, headers }
    );
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(body.url);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid URL format' }),
      { status: 400, headers }
    );
  }

  // Validate .gov domain
  const hostname = parsedUrl.hostname.toLowerCase();
  const isGov = hostname.endsWith('.gov') ||
                hostname.endsWith('.gov.in') ||
                hostname.endsWith('.gov.uk') ||
                hostname.endsWith('.gov.au') ||
                hostname.endsWith('.gc.ca') ||
                hostname.includes('.government.');

  if (!isGov) {
    return new Response(
      JSON.stringify({ error: 'Only government domains (.gov, .gov.*, .gc.ca, .government.*) are allowed' }),
      { status: 400, headers }
    );
  }

  const interval = body.interval_min || 15;
  const now = Math.floor(Date.now() / 1000);

  try {
    const result = await env.DB.prepare(`
      INSERT INTO targets (name, url, hostname, interval_min, next_check_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(body.name, body.url, hostname, interval, now, now, now).first();

    // Invalidate cache
    await env.KV.delete('latest_status');

    return new Response(JSON.stringify(result), { status: 201, headers });
  } catch (error) {
    if ((error as Error).message.includes('UNIQUE')) {
      return new Response(
        JSON.stringify({ error: 'Target URL already exists' }),
        { status: 409, headers }
      );
    }
    throw error;
  }
}

async function handleDeleteTarget(
  id: string,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  await env.DB.prepare('DELETE FROM targets WHERE id = ?').bind(parseInt(id)).run();

  // Invalidate cache
  await env.KV.delete('latest_status');

  return new Response(JSON.stringify({ success: true }), { headers });
}

async function handleGetConfig(env: Env, headers: Record<string, string>): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM config WHERE id = 1').first();
  return new Response(JSON.stringify(result), { headers });
}

async function handleUpdateConfig(
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

async function handleManualCheck(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const body = await request.json() as { targetId: number };

  if (!body.targetId) {
    return new Response(
      JSON.stringify({ error: 'targetId is required' }),
      { status: 400, headers }
    );
  }

  const target = await env.DB.prepare('SELECT * FROM targets WHERE id = ?')
    .bind(body.targetId)
    .first<Target>();

  if (!target) {
    return new Response(
      JSON.stringify({ error: 'Target not found' }),
      { status: 404, headers }
    );
  }

  const result = await checkTarget(target, env);

  return new Response(JSON.stringify(result), { headers });
}

// Core checking logic

async function checkTarget(target: Target, env: Env): Promise<CheckResult | null> {
  const startTime = Date.now();
  const timeout = parseInt(env.TIMEOUT_MS || '5000');
  const userAgent = env.USER_AGENT || 'GovMonitorBot/1.0';

  let result: CheckResult;

  try {
    // Try HEAD request first
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(target.url, {
        method: 'HEAD',
        headers: { 'User-Agent': userAgent },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      result = {
        ok: response.ok,
        status: response.status,
        latency_ms: latency,
      };
    } catch (headError) {
      clearTimeout(timeoutId);

      // Fallback to GET if HEAD not supported
      if ((headError as Error).message.includes('405')) {
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), timeout);

        const response = await fetch(target.url, {
          method: 'GET',
          headers: { 'User-Agent': userAgent },
          signal: getController.signal,
          redirect: 'follow',
        });

        clearTimeout(getTimeoutId);
        const latency = Date.now() - startTime;

        result = {
          ok: response.ok,
          status: response.status,
          latency_ms: latency,
        };
      } else {
        throw headError;
      }
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    result = {
      ok: false,
      latency_ms: latency,
      error: (error as Error).message,
    };
  }

  // Store result in D1
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO checks (target_id, ts, ok, status, latency_ms, error)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    target.id,
    now,
    result.ok ? 1 : 0,
    result.status || null,
    result.latency_ms || null,
    result.error || null
  ).run();

  // Update next check time
  const nextCheck = now + (target.interval_min * 60);
  await env.DB.prepare(
    'UPDATE targets SET next_check_at = ?, updated_at = ? WHERE id = ?'
  ).bind(nextCheck, now, target.id).run();

  // Invalidate KV cache
  await env.KV.delete('latest_status');

  console.log(`✓ Checked ${target.url}: ${result.ok ? 'UP' : 'DOWN'} (${result.latency_ms}ms)`);

  return result;
}
