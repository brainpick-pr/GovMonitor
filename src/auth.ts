/**
 * Authentication Middleware for GovMonitor.Org
 *
 * Provides API key-based authentication with support for:
 * - Bearer token validation
 * - Environment-based API keys (Phase 1)
 * - Database-backed API keys with scopes (Phase 2)
 * - Rate limiting and audit logging
 */

import type { Env, ApiKeyRecord, AuthResult } from './types';

/**
 * Protected endpoint patterns
 * These endpoints require authentication based on HTTP method
 */
const PROTECTED_ENDPOINTS = {
  // Write operations (POST/PUT/DELETE)
  write: [
    '/api/targets',
    '/api/config',
    '/api/check',
    '/api/alerts/channels',
    '/api/alerts/config',
  ],
  // Admin-only operations
  admin: [
    '/api/auth/keys',
  ],
};

/**
 * Middleware function to check if authentication is required
 *
 * @param pathname - Request URL pathname
 * @param method - HTTP method
 * @param env - Environment variables
 * @returns true if authentication is required
 */
export function requiresAuth(pathname: string, method: string, env: Env): boolean {
  // Admin endpoints always require auth
  if (PROTECTED_ENDPOINTS.admin.some(pattern => pathname.startsWith(pattern))) {
    return true;
  }

  // Write operations require auth
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    return PROTECTED_ENDPOINTS.write.some(pattern => pathname.startsWith(pattern));
  }

  // Read operations - check if auth is required via config
  if (method === 'GET' && env.REQUIRE_AUTH_FOR_READS === 'true') {
    return true;
  }

  return false;
}

/**
 * Extract bearer token from Authorization header
 *
 * @param request - HTTP request
 * @returns API key or null if not found
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer TOKEN" and "TOKEN" formats
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  // If no "Bearer" prefix, treat entire header as token
  if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

/**
 * Validate API key against environment secrets (Phase 1)
 *
 * @param token - API key to validate
 * @param env - Environment variables
 * @returns true if valid
 */
function validateApiKeyFromEnv(token: string, env: Env): boolean {
  // Check primary API key
  if (env.API_KEY && token === env.API_KEY) {
    return true;
  }

  // Check admin API keys (comma-separated)
  if (env.ADMIN_API_KEYS) {
    const adminKeys = env.ADMIN_API_KEYS.split(',').map(k => k.trim());
    if (adminKeys.includes(token)) {
      return true;
    }
  }

  // Check read-only API keys (comma-separated)
  if (env.READ_ONLY_API_KEYS) {
    const readKeys = env.READ_ONLY_API_KEYS.split(',').map(k => k.trim());
    if (readKeys.includes(token)) {
      return true;
    }
  }

  return false;
}

/**
 * Hash API key for database storage (SHA-256)
 *
 * @param key - API key to hash
 * @returns Promise resolving to hex-encoded hash
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate API key against database (Phase 2)
 *
 * @param token - API key to validate
 * @param db - D1 database instance
 * @returns Promise resolving to API key record or null
 */
async function validateApiKeyFromDB(
  token: string,
  db: D1Database
): Promise<ApiKeyRecord | null> {
  try {
    const keyHash = await hashApiKey(token);

    const result = await db
      .prepare(
        `SELECT id, name, scope, enabled, rate_limit, last_used_at, expires_at
         FROM api_keys
         WHERE key_hash = ? AND enabled = 1`
      )
      .bind(keyHash)
      .first<ApiKeyRecord>();

    if (!result) {
      return null;
    }

    // Check if key has expired
    if (result.expires_at && result.expires_at < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return result;
  } catch (error) {
    console.error('Database API key validation error:', error);
    return null;
  }
}

/**
 * Check if API key has required scope for the endpoint
 *
 * @param keyScope - Scope from API key record ('admin' | 'write' | 'read')
 * @param pathname - Request pathname
 * @param method - HTTP method
 * @returns true if key has sufficient permissions
 */
function hasRequiredScope(keyScope: string, pathname: string, method: string): boolean {
  // Admin scope has access to everything
  if (keyScope === 'admin') {
    return true;
  }

  // Admin endpoints require admin scope
  if (PROTECTED_ENDPOINTS.admin.some(pattern => pathname.startsWith(pattern))) {
    return false;
  }

  // Write scope can perform write operations
  if (keyScope === 'write' && ['POST', 'PUT', 'DELETE'].includes(method)) {
    return true;
  }

  // Read scope can only perform GET requests
  if (keyScope === 'read' && method === 'GET') {
    return true;
  }

  return false;
}

/**
 * Check rate limit for API key
 *
 * @param kv - KV namespace
 * @param apiKeyId - API key ID
 * @param rateLimit - Requests per hour limit
 * @returns Promise resolving to true if within limit, false if exceeded
 */
async function checkRateLimit(
  kv: KVNamespace,
  apiKeyId: number,
  rateLimit: number
): Promise<boolean> {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13); // Format: "2026-01-26T08"
  const rateLimitKey = `RATE_LIMIT:${apiKeyId}:${hour}`;

  try {
    const currentCount = await kv.get(rateLimitKey);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    if (count >= rateLimit) {
      return false; // Rate limit exceeded
    }

    // Increment counter with 1 hour TTL
    await kv.put(rateLimitKey, (count + 1).toString(), {
      expirationTtl: 3600, // 1 hour
    });

    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow request on error to prevent false positives
    return true;
  }
}

/**
 * Log authentication attempt to audit log
 *
 * @param db - D1 database instance
 * @param apiKeyId - API key ID (null for failed attempts)
 * @param request - HTTP request
 * @param success - Whether authentication succeeded
 * @param error - Error message for failed attempts
 */
async function logAuthAttempt(
  db: D1Database,
  apiKeyId: number | null,
  request: Request,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    const url = new URL(request.url);
    const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO auth_audit_log
         (api_key_id, endpoint, method, ip_address, user_agent, success, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        apiKeyId,
        url.pathname,
        request.method,
        ipAddress,
        userAgent,
        success ? 1 : 0,
        error || null,
        now
      )
      .run();
  } catch (logError) {
    // Don't fail the request if logging fails
    console.error('Auth audit log error:', logError);
  }
}

/**
 * Update last_used_at timestamp for API key
 *
 * @param db - D1 database instance
 * @param apiKeyId - API key ID
 */
async function updateLastUsed(db: D1Database, apiKeyId: number): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
      .bind(now, apiKeyId)
      .run();
  } catch (error) {
    console.error('Failed to update last_used_at:', error);
  }
}

/**
 * Main authentication middleware function
 *
 * Validates request authentication and returns error response if invalid.
 * Returns null if authentication is successful.
 *
 * @param request - HTTP request
 * @param env - Environment variables
 * @returns Promise resolving to error Response or null if authenticated
 */
export async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);

  // Check if this endpoint requires auth
  if (!requiresAuth(url.pathname, request.method, env)) {
    return null; // No auth required
  }

  // Extract bearer token
  const token = extractBearerToken(request);
  if (!token) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Use: Authorization: Bearer YOUR_API_KEY',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Phase 1: Validate against environment variables
  const isValidEnvKey = validateApiKeyFromEnv(token, env);

  // Phase 2: Try database validation if env validation fails
  let apiKeyRecord: ApiKeyRecord | null = null;
  if (!isValidEnvKey) {
    apiKeyRecord = await validateApiKeyFromDB(token, env.DB);

    if (!apiKeyRecord) {
      // Log failed attempt (no API key ID)
      await logAuthAttempt(env.DB, null, request, false, 'Invalid API key');

      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Invalid API key',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // If using database key, check additional constraints
  if (apiKeyRecord) {
    // Check scope permissions
    if (!hasRequiredScope(apiKeyRecord.scope, url.pathname, request.method)) {
      await logAuthAttempt(env.DB, apiKeyRecord.id, request, false, 'Insufficient permissions');

      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: `Insufficient permissions. Required scope: ${request.method === 'GET' ? 'read' : 'write or admin'}`,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check rate limit
    const withinRateLimit = await checkRateLimit(env.KV, apiKeyRecord.id, apiKeyRecord.rate_limit);
    if (!withinRateLimit) {
      await logAuthAttempt(env.DB, apiKeyRecord.id, request, false, 'Rate limit exceeded');

      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Limit: ${apiKeyRecord.rate_limit} requests/hour`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '3600', // Try again in 1 hour
          },
        }
      );
    }

    // Log successful attempt
    await logAuthAttempt(env.DB, apiKeyRecord.id, request, true);

    // Update last used timestamp (async, don't wait)
    updateLastUsed(env.DB, apiKeyRecord.id).catch(err =>
      console.error('Failed to update last_used_at:', err)
    );
  }

  // Authentication successful
  return null;
}

/**
 * Generate a cryptographically secure API key
 *
 * @returns Promise resolving to 43-character base64url encoded key
 */
export async function generateApiKey(): Promise<string> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));

  // Convert to base64url encoding
  const base64 = btoa(String.fromCharCode(...randomBytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
