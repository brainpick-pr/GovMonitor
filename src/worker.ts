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

type CheckMode = 'website' | 'api-json' | 'api-text';

interface Target {
  id: number;
  name: string;
  url: string;
  hostname: string;
  state: string;
  interval_min: number;
  next_check_at: number;
  enabled: number;
  check_mode: CheckMode;
  expected_status: number;
  allowed_status_codes: string | null; // JSON array of numbers
  json_path: string | null;
  expected_json_value: string | null;
  text_match: string | null;
}

interface CheckResult {
  ok: boolean;
  status?: number;
  latency_ms?: number;
  error?: string;
  validation_details?: string;
}

type AddTargetPayload = {
  name: string;
  url: string;
  interval_min?: number;
  state?: string;
  check_mode?: CheckMode;
  expected_status?: number;
  allowed_status_codes?: number[];
  json_path?: string;
  expected_json_value?: string;
  text_match?: string;
};

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

const VALID_STATES = new Set(INDIAN_STATES.map(state => state.toLowerCase()));

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

      if (url.pathname === '/api/state-summary' && request.method === 'GET') {
        const window = url.searchParams.get('window') || '24h';
        return await handleGetStateSummary(env, window, corsHeaders);
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
    const cronMinute = new Date(event.scheduledTime).getMinutes();
    console.log('Cron trigger fired:', new Date(event.scheduledTime).toISOString());

    try {
      const now = Math.floor(Date.now() / 1000);

      // Run backfill check on the hour (minute 0) to catch missed checks
      if (cronMinute === 0) {
        await runBackfillCheck(env, now);
      }

      // Get all targets that need checking
      const targets = await env.DB.prepare(
        'SELECT * FROM targets WHERE enabled = 1 AND next_check_at <= ?'
      ).bind(now).all<Target>();

      if (!targets.results || targets.results.length === 0) {
        console.log('No targets to check');
        return;
      }

      console.log(`Checking ${targets.results.length} targets`);

      // Batch targets in groups of 25 to respect execution limits
      const BATCH_SIZE = 25;
      const batches: Target[][] = [];
      for (let i = 0; i < targets.results.length; i += BATCH_SIZE) {
        batches.push(targets.results.slice(i, i + BATCH_SIZE));
      }

      // Process each batch with Promise.allSettled to prevent single failures from aborting
      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map(target => checkTarget(target, env))
        );

        // Log any failures
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            console.error(`Failed to check ${batch[idx].url}:`, result.reason);
          }
        });
      }

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
  const cached = await env.KV.get('latest_status', 'json') as unknown;
  if (
    Array.isArray(cached) &&
    cached.every(item => item && (typeof item.state === 'string' || item.state === null))
  ) {
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

  // Cache in KV for 60 seconds (minimum TTL)
  await env.KV.put('latest_status', JSON.stringify(data), { expirationTtl: 60 });

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

  const windowSeconds: Record<string, number> = {
    '24h': 86400,
    '7d': 604800,
    '30d': 2592000,
    '365d': 31536000,
  };
  const seconds = windowSeconds[window] || 86400;
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
  const body = await request.json() as AddTargetPayload;
  const state = (body.state || '').trim();

  if (!body.name || !body.url) {
    return new Response(
      JSON.stringify({ error: 'name and url are required' }),
      { status: 400, headers }
    );
  }

  if (!state || !VALID_STATES.has(state.toLowerCase())) {
    return new Response(
      JSON.stringify({ error: 'A valid Indian state or union territory is required' }),
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
  const checkMode = body.check_mode || 'website';
  const expectedStatus = body.expected_status || 200;
  const allowedStatusCodes = body.allowed_status_codes ? JSON.stringify(body.allowed_status_codes) : null;
  const jsonPath = body.json_path || null;
  const expectedJsonValue = body.expected_json_value || null;
  const textMatch = body.text_match || null;
  const now = Math.floor(Date.now() / 1000);

  try {
    const result = await env.DB.prepare(`
      INSERT INTO targets (
        name, url, hostname, state, interval_min, next_check_at,
        check_mode, expected_status, allowed_status_codes,
        json_path, expected_json_value, text_match,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      body.name, body.url, hostname, state, interval, now,
      checkMode, expectedStatus, allowedStatusCodes,
      jsonPath, expectedJsonValue, textMatch,
      now, now
    ).first();

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

async function handleGetStateSummary(
  env: Env,
  window: string,
  headers: Record<string, string>
): Promise<Response> {
  const cacheKey = `state_summary_${window}`;

  // Try KV cache first
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) {
    return new Response(JSON.stringify(cached), { headers });
  }

  // Map window to view name
  const viewMap: Record<string, string> = {
    '24h': 'state_uptime_24h',
    '7d': 'state_uptime_7d',
    '30d': 'state_uptime_30d',
    '365d': 'state_uptime_365d',
  };

  const viewName = viewMap[window] || 'state_uptime_24h';

  // Query from D1
  const result = await env.DB.prepare(`SELECT * FROM ${viewName} ORDER BY state`).all();
  const data = result.results || [];

  // Cache in KV for 5 minutes
  await env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });

  return new Response(JSON.stringify(data), { headers });
}

// Backfill handler for missed checks

async function runBackfillCheck(env: Env, now: number): Promise<void> {
  console.log('Running backfill check for stale targets...');

  // Find targets whose next_check_at is more than 2x their interval in the past
  // This indicates they missed their scheduled check window
  const staleTargets = await env.DB.prepare(`
    SELECT * FROM targets
    WHERE enabled = 1
    AND next_check_at < ? - (interval_min * 60 * 2)
    ORDER BY next_check_at ASC
    LIMIT 50
  `).bind(now).all<Target>();

  if (!staleTargets.results || staleTargets.results.length === 0) {
    console.log('No stale targets found for backfill');
    return;
  }

  console.log(`Found ${staleTargets.results.length} stale targets to backfill`);

  // Log structured output for observability
  console.log(JSON.stringify({
    event: 'backfill_started',
    stale_count: staleTargets.results.length,
    timestamp: new Date().toISOString(),
  }));

  // Reset their next_check_at to now so they get picked up in the regular check
  // Also queue them for immediate checking
  const BATCH_SIZE = 10;
  const batches: Target[][] = [];
  for (let i = 0; i < staleTargets.results.length; i += BATCH_SIZE) {
    batches.push(staleTargets.results.slice(i, i + BATCH_SIZE));
  }

  let checkedCount = 0;
  let failedCount = 0;

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(async (target) => {
        // Update next_check_at to prevent re-queuing on next run
        await env.DB.prepare(
          'UPDATE targets SET next_check_at = ? WHERE id = ?'
        ).bind(now + (target.interval_min * 60), target.id).run();

        // Perform the check
        return checkTarget(target, env);
      })
    );

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        checkedCount++;
      } else {
        failedCount++;
        console.error(`Backfill check failed for ${batch[idx].url}:`, result.reason);
      }
    });
  }

  console.log(JSON.stringify({
    event: 'backfill_completed',
    checked: checkedCount,
    failed: failedCount,
    timestamp: new Date().toISOString(),
  }));

  console.log(`Backfill completed: ${checkedCount} checked, ${failedCount} failed`);
}

// Core checking logic

function getJsonValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }

  return value;
}

async function checkTarget(target: Target, env: Env): Promise<CheckResult | null> {
  const startTime = Date.now();
  const timeout = parseInt(env.TIMEOUT_MS || '5000');
  const userAgent = env.USER_AGENT || 'GovMonitorBot/1.0';

  let result: CheckResult;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const requestInit: RequestInit = {
      method: target.check_mode === 'website' ? 'HEAD' : 'GET',
      headers: { 'User-Agent': userAgent },
      signal: controller.signal,
      redirect: 'follow',
      cf: {
        cacheTtl: 0, // Bypass cache for health checks
      } as RequestInitCfProperties,
    };

    let response: Response;
    let responseBody: string | null = null;

    try {
      response = await fetch(target.url, requestInit);
      clearTimeout(timeoutId);

      // For API checks, we need the response body
      if (target.check_mode === 'api-json' || target.check_mode === 'api-text') {
        responseBody = await response.text();
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Fallback to GET if HEAD not supported
      if (target.check_mode === 'website' && (fetchError as Error).message.includes('405')) {
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), timeout);

        response = await fetch(target.url, {
          ...requestInit,
          method: 'GET',
          signal: getController.signal,
        });

        clearTimeout(getTimeoutId);
      } else {
        throw fetchError;
      }
    }

    const latency = Date.now() - startTime;

    // Validate status code
    const allowedCodes = target.allowed_status_codes
      ? JSON.parse(target.allowed_status_codes) as number[]
      : [target.expected_status];

    const statusOk = allowedCodes.includes(response.status);
    let validationOk = true;
    let validationDetails = '';

    // Mode-specific validation
    if (statusOk && target.check_mode === 'api-json' && responseBody) {
      try {
        const jsonData = JSON.parse(responseBody);

        if (target.json_path && target.expected_json_value) {
          const actualValue = getJsonValue(jsonData, target.json_path);
          validationOk = actualValue === target.expected_json_value;
          validationDetails = validationOk
            ? `JSON validation passed: ${target.json_path} = ${actualValue}`
            : `JSON validation failed: ${target.json_path} = ${actualValue}, expected ${target.expected_json_value}`;
        }
      } catch (parseError) {
        validationOk = false;
        validationDetails = `Invalid JSON response: ${(parseError as Error).message}`;
      }
    } else if (statusOk && target.check_mode === 'api-text' && responseBody && target.text_match) {
      validationOk = responseBody.includes(target.text_match);
      validationDetails = validationOk
        ? `Text match found: "${target.text_match}"`
        : `Text match failed: "${target.text_match}" not found`;
    }

    result = {
      ok: statusOk && validationOk,
      status: response.status,
      latency_ms: latency,
      validation_details: validationDetails || undefined,
    };

    // Log structured output for Logpush
    console.log(JSON.stringify({
      event: 'health_check',
      target_id: target.id,
      target_name: target.name,
      url: target.url,
      check_mode: target.check_mode,
      status: response.status,
      latency_ms: latency,
      ok: result.ok,
      validation_details: validationDetails,
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
