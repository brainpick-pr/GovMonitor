/**
 * Authentication API Handlers
 * Endpoints for managing API keys (admin only)
 */

import type { Env, CreateApiKeyPayload, ApiKeyRecord } from '../types';
import { generateApiKey, hashApiKey } from '../auth';

/**
 * GET /api/auth/keys - List all API keys (admin only)
 *
 * @param env - Environment variables
 * @param corsHeaders - CORS headers
 * @returns Response with list of API keys (without key_hash for security)
 */
export async function handleListApiKeys(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      `SELECT id, name, scope, enabled, rate_limit, last_used_at, created_at, expires_at
       FROM api_keys
       ORDER BY created_at DESC`
    ).all<ApiKeyRecord>();

    return new Response(JSON.stringify(result.results || []), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list API keys', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/auth/keys - Create new API key (admin only)
 *
 * @param request - HTTP request
 * @param env - Environment variables
 * @param corsHeaders - CORS headers
 * @returns Response with newly created API key (plaintext - only shown once!)
 */
export async function handleCreateApiKey(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const payload: CreateApiKeyPayload = await request.json();

    // Validate required fields
    if (!payload.name || !payload.scope) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, scope' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate scope
    if (!['admin', 'write', 'read'].includes(payload.scope)) {
      return new Response(
        JSON.stringify({ error: 'Invalid scope. Must be: admin, write, or read' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate new API key
    const apiKey = await generateApiKey();
    const keyHash = await hashApiKey(apiKey);

    // Set defaults
    const rateLimit = payload.rate_limit || 1000;
    const expiresAt = payload.expires_at || null;
    const now = Math.floor(Date.now() / 1000);

    // Insert into database
    const result = await env.DB.prepare(
      `INSERT INTO api_keys (name, key_hash, scope, enabled, rate_limit, created_at, expires_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`
    )
      .bind(payload.name, keyHash, payload.scope, rateLimit, now, expiresAt)
      .run();

    if (!result.success) {
      throw new Error('Failed to insert API key');
    }

    // Return the plaintext key (ONLY TIME IT'S SHOWN!)
    return new Response(
      JSON.stringify({
        message: 'API key created successfully',
        api_key: apiKey, // Plaintext key - save this!
        key_info: {
          id: result.meta.last_row_id,
          name: payload.name,
          scope: payload.scope,
          rate_limit: rateLimit,
          expires_at: expiresAt,
        },
        warning: 'Save this key now! It will not be shown again.',
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error creating API key:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create API key', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/auth/keys/:id - Revoke API key (admin only)
 *
 * @param keyId - API key ID to revoke
 * @param env - Environment variables
 * @param corsHeaders - CORS headers
 * @returns Response confirming revocation
 */
export async function handleRevokeApiKey(
  keyId: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const id = parseInt(keyId, 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid key ID' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Soft delete by disabling the key
    const result = await env.DB.prepare('UPDATE api_keys SET enabled = 0 WHERE id = ?')
      .bind(id)
      .run();

    if (!result.success) {
      throw new Error('Failed to revoke API key');
    }

    return new Response(
      JSON.stringify({ message: 'API key revoked successfully', id }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error revoking API key:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to revoke API key', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/auth/keys/:id - Update API key settings (admin only)
 *
 * @param keyId - API key ID to update
 * @param request - HTTP request
 * @param env - Environment variables
 * @param corsHeaders - CORS headers
 * @returns Response confirming update
 */
export async function handleUpdateApiKey(
  keyId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const id = parseInt(keyId, 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid key ID' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const payload: Partial<CreateApiKeyPayload> & { enabled?: boolean } = await request.json();

    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const bindings: any[] = [];

    if (payload.name !== undefined) {
      updates.push('name = ?');
      bindings.push(payload.name);
    }

    if (payload.scope !== undefined) {
      if (!['admin', 'write', 'read'].includes(payload.scope)) {
        return new Response(
          JSON.stringify({ error: 'Invalid scope. Must be: admin, write, or read' }),
          { status: 400, headers: corsHeaders }
        );
      }
      updates.push('scope = ?');
      bindings.push(payload.scope);
    }

    if (payload.rate_limit !== undefined) {
      updates.push('rate_limit = ?');
      bindings.push(payload.rate_limit);
    }

    if (payload.enabled !== undefined) {
      updates.push('enabled = ?');
      bindings.push(payload.enabled ? 1 : 0);
    }

    if (payload.expires_at !== undefined) {
      updates.push('expires_at = ?');
      bindings.push(payload.expires_at);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    bindings.push(id); // Add ID for WHERE clause

    const result = await env.DB.prepare(
      `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...bindings)
      .run();

    if (!result.success) {
      throw new Error('Failed to update API key');
    }

    return new Response(
      JSON.stringify({ message: 'API key updated successfully', id }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error updating API key:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update API key', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/auth/keys/:id/rotate - Rotate API key (generate new key, invalidate old)
 *
 * @param keyId - API key ID to rotate
 * @param env - Environment variables
 * @param corsHeaders - CORS headers
 * @returns Response with new API key
 */
export async function handleRotateApiKey(
  keyId: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const id = parseInt(keyId, 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid key ID' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Generate new API key
    const newApiKey = await generateApiKey();
    const newKeyHash = await hashApiKey(newApiKey);

    // Update the key hash
    const result = await env.DB.prepare('UPDATE api_keys SET key_hash = ? WHERE id = ?')
      .bind(newKeyHash, id)
      .run();

    if (!result.success) {
      throw new Error('Failed to rotate API key');
    }

    // Get updated key info
    const keyInfo = await env.DB.prepare(
      'SELECT name, scope, rate_limit FROM api_keys WHERE id = ?'
    )
      .bind(id)
      .first();

    return new Response(
      JSON.stringify({
        message: 'API key rotated successfully',
        api_key: newApiKey, // New plaintext key - save this!
        key_info: {
          id,
          ...(keyInfo as any),
        },
        warning: 'Save this new key now! The old key is now invalid.',
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error rotating API key:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to rotate API key', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/auth/audit - Get authentication audit log (admin only)
 *
 * @param env - Environment variables
 * @param searchParams - Query parameters (limit, offset, success filter)
 * @param corsHeaders - CORS headers
 * @returns Response with audit log entries
 */
export async function handleGetAuditLog(
  env: Env,
  searchParams: URLSearchParams,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const successFilter = searchParams.get('success'); // '1', '0', or null (all)

    let query = `
      SELECT
        al.id,
        al.api_key_id,
        ak.name as api_key_name,
        al.endpoint,
        al.method,
        al.ip_address,
        al.user_agent,
        al.success,
        al.error_message,
        al.created_at
      FROM auth_audit_log al
      LEFT JOIN api_keys ak ON al.api_key_id = ak.id
    `;

    const bindings: any[] = [];

    if (successFilter !== null) {
      query += ' WHERE al.success = ?';
      bindings.push(parseInt(successFilter, 10));
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    return new Response(
      JSON.stringify({
        entries: result.results || [],
        limit,
        offset,
        count: result.results?.length || 0,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch audit log', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
