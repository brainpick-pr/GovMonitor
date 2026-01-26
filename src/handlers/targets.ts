/**
 * /api/targets handlers
 * GET, POST, and DELETE operations for targets
 */

import type { Env, AddTargetPayload } from '../types';
import { VALIDATION } from '../constants';
import { isGovernmentDomain, isValidState, validateUrl } from '../utils/validation';
import { invalidateStatusCache } from '../utils/cache';

export async function handleGetTargets(
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const result = await env.DB.prepare('SELECT * FROM targets ORDER BY name').all();
  return new Response(JSON.stringify(result.results || []), { headers });
}

export async function handleAddTarget(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const body = await request.json() as AddTargetPayload;

  // Validate name
  const name = (body.name || '').trim();
  if (!name) {
    return new Response(
      JSON.stringify({ error: 'Name is required' }),
      { status: 400, headers }
    );
  }
  if (name.length > VALIDATION.MAX_NAME_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Name must be ${VALIDATION.MAX_NAME_LENGTH} characters or less` }),
      { status: 400, headers }
    );
  }

  // Validate URL
  const url = (body.url || '').trim();
  if (!url) {
    return new Response(
      JSON.stringify({ error: 'URL is required' }),
      { status: 400, headers }
    );
  }
  if (url.length > VALIDATION.MAX_URL_LENGTH) {
    return new Response(
      JSON.stringify({ error: `URL must be ${VALIDATION.MAX_URL_LENGTH} characters or less` }),
      { status: 400, headers }
    );
  }

  const parsedUrl = validateUrl(url);
  if (!parsedUrl) {
    return new Response(
      JSON.stringify({ error: 'Invalid URL format' }),
      { status: 400, headers }
    );
  }

  // Validate state
  const state = (body.state || '').trim();
  if (!state || !isValidState(state)) {
    return new Response(
      JSON.stringify({ error: 'A valid Indian state or union territory is required' }),
      { status: 400, headers }
    );
  }

  // Validate .gov domain
  const hostname = parsedUrl.hostname.toLowerCase();
  if (!isGovernmentDomain(hostname)) {
    return new Response(
      JSON.stringify({ error: 'Only government domains (.gov, .gov.*, .gc.ca, .government.*) are allowed' }),
      { status: 400, headers }
    );
  }

  // Validate interval
  const interval = body.interval_min || 15;
  if (interval < VALIDATION.MIN_INTERVAL || interval > VALIDATION.MAX_INTERVAL) {
    return new Response(
      JSON.stringify({
        error: `Interval must be between ${VALIDATION.MIN_INTERVAL} and ${VALIDATION.MAX_INTERVAL} minutes`
      }),
      { status: 400, headers }
    );
  }

  // Validate check mode
  const checkMode = body.check_mode || 'website';
  if (!VALIDATION.VALID_CHECK_MODES.has(checkMode)) {
    return new Response(
      JSON.stringify({
        error: `Invalid check_mode. Must be one of: ${Array.from(VALIDATION.VALID_CHECK_MODES).join(', ')}`
      }),
      { status: 400, headers }
    );
  }

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
      name, url, hostname, state, interval, now,
      checkMode, expectedStatus, allowedStatusCodes,
      jsonPath, expectedJsonValue, textMatch,
      now, now
    ).first();

    // Invalidate cache
    await invalidateStatusCache(env.KV);

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

export async function handleDeleteTarget(
  id: string,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  await env.DB.prepare('DELETE FROM targets WHERE id = ?').bind(parseInt(id)).run();

  // Invalidate cache
  await invalidateStatusCache(env.KV);

  return new Response(JSON.stringify({ success: true }), { headers });
}
