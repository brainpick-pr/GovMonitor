/**
 * Google OAuth Handler
 * Endpoints for user authentication via Google OAuth 2.0
 */

import type { Env, User, UserSession } from '../types';

// Google OAuth token response
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

// Google user info response
interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

/**
 * Generate a secure session token
 */
async function generateSessionToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash session token for storage
 */
async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Log user IP activity
 */
async function logUserActivity(
  env: Env,
  userId: number,
  ipAddress: string,
  action: string,
  resourceType?: string,
  resourceId?: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO user_ip_log (user_id, ip_address, action, resource_type, resource_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        userId,
        ipAddress,
        action,
        resourceType || null,
        resourceId || null,
        metadata ? JSON.stringify(metadata) : null,
        Math.floor(Date.now() / 1000)
      )
      .run();
  } catch (error) {
    console.error('Error logging user activity:', error);
  }
}

/**
 * Extract client IP from request
 */
function getClientIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'unknown'
  );
}

/**
 * POST /api/auth/google - Exchange Google auth code for session
 *
 * @param request - HTTP request with { code: string, redirect_uri: string }
 * @param env - Environment variables
 * @param corsHeaders - CORS headers
 * @returns Response with session token and user info
 */
export async function handleGoogleAuth(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const { code, redirect_uri } = await request.json() as { code: string; redirect_uri: string };

    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: code, redirect_uri' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check for required environment variables
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials');
      return new Response(
        JSON.stringify({ error: 'OAuth not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Google token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Fetch user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to fetch Google user info');
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user information' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    if (!googleUser.verified_email) {
      return new Response(
        JSON.stringify({ error: 'Email not verified with Google' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('User-Agent') || 'unknown';

    // Check if user exists
    let user = await env.DB.prepare('SELECT * FROM users WHERE google_id = ?')
      .bind(googleUser.id)
      .first<User>();

    if (user) {
      // Check if user is banned
      if (user.is_banned) {
        return new Response(
          JSON.stringify({
            error: 'Account suspended',
            reason: user.ban_reason || 'Violation of community guidelines',
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Update existing user
      await env.DB.prepare(
        `UPDATE users SET
          email = ?,
          display_name = ?,
          avatar_url = ?,
          last_login_at = ?,
          updated_at = ?
        WHERE id = ?`
      )
        .bind(googleUser.email, googleUser.name, googleUser.picture || null, now, now, user.id)
        .run();
    } else {
      // Create new user
      const result = await env.DB.prepare(
        `INSERT INTO users (google_id, email, display_name, avatar_url, role, reputation_score, is_banned, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, 'user', 0, 0, ?, ?, ?)`
      )
        .bind(googleUser.id, googleUser.email, googleUser.name, googleUser.picture || null, now, now, now)
        .run();

      if (!result.success) {
        throw new Error('Failed to create user');
      }

      user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(result.meta.last_row_id)
        .first<User>();
    }

    if (!user) {
      throw new Error('Failed to retrieve user after creation/update');
    }

    // Create session
    const sessionToken = await generateSessionToken();
    const sessionExpiry = now + 30 * 24 * 60 * 60; // 30 days

    await env.DB.prepare(
      `INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address, user_agent, created_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(user.id, sessionToken, sessionExpiry, ipAddress, userAgent, now, now)
      .run();

    // Log login activity
    await logUserActivity(env, user.id, ipAddress, 'login', undefined, undefined, { user_agent: userAgent });

    // Return session and user info
    return new Response(
      JSON.stringify({
        session_token: sessionToken,
        expires_at: sessionExpiry,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          role: user.role,
          reputation_score: user.reputation_score,
          created_at: user.created_at,
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error in Google OAuth:', error);
    return new Response(
      JSON.stringify({ error: 'Authentication failed', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/auth/me - Get current authenticated user
 *
 * @param request - HTTP request with Authorization header
 * @param env - Environment variables
 * @param corsHeaders - CORS headers
 * @returns Response with user info or 401 if not authenticated
 */
export async function handleGetCurrentUser(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const sessionToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Find valid session and user
    const result = await env.DB.prepare(
      `SELECT
        u.id, u.email, u.display_name, u.avatar_url, u.role,
        u.reputation_score, u.is_banned, u.created_at,
        s.id as session_id, s.expires_at
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = ?
        AND s.expires_at > ?
        AND u.is_banned = 0`
    )
      .bind(sessionToken, now)
      .first();

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Update session last activity
    await env.DB.prepare('UPDATE user_sessions SET last_activity_at = ? WHERE id = ?')
      .bind(now, result.session_id)
      .run();

    return new Response(
      JSON.stringify({
        user: {
          id: result.id,
          email: result.email,
          display_name: result.display_name,
          avatar_url: result.avatar_url,
          role: result.role,
          reputation_score: result.reputation_score,
          created_at: result.created_at,
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting current user:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get user', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/auth/logout - Invalidate current session
 *
 * @param request - HTTP request with Authorization header
 * @param env - Environment variables
 * @param corsHeaders - CORS headers
 * @returns Response confirming logout
 */
export async function handleLogout(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ message: 'Already logged out' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const sessionToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ message: 'Already logged out' }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get user ID for logging before deleting session
    const session = await env.DB.prepare(
      'SELECT user_id FROM user_sessions WHERE session_token = ?'
    )
      .bind(sessionToken)
      .first<{ user_id: number }>();

    // Delete the session
    await env.DB.prepare('DELETE FROM user_sessions WHERE session_token = ?')
      .bind(sessionToken)
      .run();

    // Log logout activity
    if (session) {
      const ipAddress = getClientIP(request);
      await logUserActivity(env, session.user_id, ipAddress, 'logout');
    }

    return new Response(
      JSON.stringify({ message: 'Logged out successfully' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error logging out:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to logout', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Validate session and return user (utility function for other handlers)
 */
export async function validateSession(
  request: Request,
  env: Env
): Promise<User | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return null;

    const sessionToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!sessionToken) return null;

    const now = Math.floor(Date.now() / 1000);

    const result = await env.DB.prepare(
      `SELECT u.*
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = ?
         AND s.expires_at > ?
         AND u.is_banned = 0`
    )
      .bind(sessionToken, now)
      .first<User>();

    return result || null;
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
}

/**
 * Require authenticated user (utility function for protected routes)
 */
export async function requireUser(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<User | Response> {
  const user = await validateSession(request, env);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: corsHeaders }
    );
  }
  return user;
}

/**
 * Require moderator or admin role
 */
export async function requireModerator(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<User | Response> {
  const result = await requireUser(request, env, corsHeaders);
  if (result instanceof Response) return result;

  const user = result as User;
  if (!['moderator', 'admin'].includes(user.role)) {
    return new Response(
      JSON.stringify({ error: 'Moderator access required' }),
      { status: 403, headers: corsHeaders }
    );
  }
  return user;
}

/**
 * Require admin role
 */
export async function requireAdmin(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<User | Response> {
  const result = await requireUser(request, env, corsHeaders);
  if (result instanceof Response) return result;

  const user = result as User;
  if (user.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: corsHeaders }
    );
  }
  return user;
}

/**
 * Log user activity helper (exported for use by other handlers)
 */
export { logUserActivity, getClientIP };
