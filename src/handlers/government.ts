/**
 * Government Integration Handlers
 * Endpoints for government user verification, responses, and appeals
 */

import type { Env, User, AppealType, AppealStatus, GovernmentDepartment } from '../types';
import { requireUser, requireModerator, logUserActivity, getClientIP } from './oauth';

const VALID_APPEAL_TYPES: AppealType[] = ['status_dispute', 'data_correction', 'removal_request'];
const VALID_APPEAL_STATUSES: AppealStatus[] = ['pending', 'under_review', 'approved', 'rejected'];

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * GET /api/government/departments - List government departments
 */
export async function handleListDepartments(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const verified = url.searchParams.get('verified');

    let query = 'SELECT * FROM government_departments WHERE 1=1';
    const bindings: any[] = [];

    if (state) {
      query += ' AND (state = ? OR state IS NULL)';
      bindings.push(state);
    }

    if (verified === 'true') {
      query += ' AND verified = 1';
    }

    query += ' ORDER BY name ASC';

    const result = await env.DB.prepare(query).bind(...bindings).all<GovernmentDepartment>();

    return new Response(
      JSON.stringify({ departments: result.results || [] }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error listing departments:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list departments', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/government/verify - Request government verification
 */
export async function handleRequestVerification(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const { department_id } = await request.json() as { department_id: number };

    if (!department_id) {
      return new Response(
        JSON.stringify({ error: 'Department ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get department
    const department = await env.DB.prepare(
      'SELECT * FROM government_departments WHERE id = ? AND verified = 1'
    ).bind(department_id).first<GovernmentDepartment>();

    if (!department) {
      return new Response(
        JSON.stringify({ error: 'Department not found or not verified' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if user email matches department domain
    const userEmailDomain = user.email.split('@')[1];
    if (userEmailDomain !== department.email_domain) {
      return new Response(
        JSON.stringify({
          error: 'Email domain mismatch',
          message: `Your email domain (${userEmailDomain}) does not match the department domain (${department.email_domain})`
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Check for existing pending verification
    const existingVerification = await env.DB.prepare(
      `SELECT * FROM government_verifications
       WHERE user_id = ? AND department_id = ? AND verified = 0 AND expires_at > ?`
    ).bind(user.id, department_id, Math.floor(Date.now() / 1000)).first();

    if (existingVerification) {
      return new Response(
        JSON.stringify({
          error: 'Verification already pending',
          message: 'A verification code has already been sent. Please check your email.'
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    // Check if already verified
    const alreadyVerified = await env.DB.prepare(
      'SELECT * FROM government_verifications WHERE user_id = ? AND department_id = ? AND verified = 1'
    ).bind(user.id, department_id).first();

    if (alreadyVerified) {
      return new Response(
        JSON.stringify({
          error: 'Already verified',
          message: 'You are already verified for this department.'
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const verificationCode = generateVerificationCode();
    const expiresAt = now + 24 * 60 * 60; // 24 hours

    // Create verification request
    await env.DB.prepare(
      `INSERT INTO government_verifications (user_id, department_id, verification_code, code_sent_at, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(user.id, department_id, verificationCode, now, expiresAt, now).run();

    // In production, send verification email here
    // For now, return the code in development
    const isDev = env.ENVIRONMENT !== 'production';

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'profile_update', 'verification', department_id, {
      action: 'verification_requested'
    });

    return new Response(
      JSON.stringify({
        message: 'Verification code sent to your email',
        expires_at: expiresAt,
        ...(isDev && { verification_code: verificationCode }) // Only in dev
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error requesting verification:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to request verification', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/government/verify/confirm - Confirm verification code
 */
export async function handleConfirmVerification(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const { code, department_id } = await request.json() as { code: string; department_id: number };

    if (!code || !department_id) {
      return new Response(
        JSON.stringify({ error: 'Verification code and department ID are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Find verification request
    const verification = await env.DB.prepare(
      `SELECT * FROM government_verifications
       WHERE user_id = ? AND department_id = ? AND verified = 0 AND expires_at > ?`
    ).bind(user.id, department_id, now).first<{
      id: number;
      verification_code: string;
      attempts: number;
    }>();

    if (!verification) {
      return new Response(
        JSON.stringify({ error: 'No pending verification found or code expired' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check attempts limit
    if (verification.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please request a new verification code.' }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Increment attempts
    await env.DB.prepare(
      'UPDATE government_verifications SET attempts = attempts + 1 WHERE id = ?'
    ).bind(verification.id).run();

    // Verify code
    if (verification.verification_code !== code) {
      return new Response(
        JSON.stringify({
          error: 'Invalid verification code',
          attempts_remaining: 5 - verification.attempts - 1
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Mark as verified
    await env.DB.prepare(
      'UPDATE government_verifications SET verified = 1, verified_at = ? WHERE id = ?'
    ).bind(now, verification.id).run();

    // Update user role to government
    await env.DB.prepare(
      'UPDATE users SET role = ?, updated_at = ? WHERE id = ?'
    ).bind('government', now, user.id).run();

    // Add user to department
    await env.DB.prepare(
      `INSERT OR IGNORE INTO government_user_departments (user_id, department_id, role, assigned_at)
       VALUES (?, ?, 'responder', ?)`
    ).bind(user.id, department_id, now).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'profile_update', 'verification', department_id, {
      action: 'verification_confirmed'
    });

    return new Response(
      JSON.stringify({
        message: 'Verification successful! You now have government user access.',
        role: 'government'
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error confirming verification:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to confirm verification', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/appeals - Submit API status appeal
 */
export async function handleSubmitAppeal(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    // Must be government user to submit appeals
    if (user.role !== 'government' && user.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only verified government users can submit appeals' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const { target_id, appeal_type, reason, evidence_url } = await request.json() as {
      target_id: number;
      appeal_type: AppealType;
      reason: string;
      evidence_url?: string;
    };

    if (!target_id || !appeal_type || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: target_id, appeal_type, reason' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!VALID_APPEAL_TYPES.includes(appeal_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid appeal type', valid_types: VALID_APPEAL_TYPES }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check target exists
    const target = await env.DB.prepare('SELECT id, name FROM targets WHERE id = ?')
      .bind(target_id).first();

    if (!target) {
      return new Response(
        JSON.stringify({ error: 'Target not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check for existing pending appeal
    const existingAppeal = await env.DB.prepare(
      `SELECT id FROM api_appeals
       WHERE user_id = ? AND target_id = ? AND status IN ('pending', 'under_review')`
    ).bind(user.id, target_id).first();

    if (existingAppeal) {
      return new Response(
        JSON.stringify({ error: 'You already have a pending appeal for this target' }),
        { status: 409, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Create appeal
    const result = await env.DB.prepare(
      `INSERT INTO api_appeals (user_id, target_id, appeal_type, reason, evidence_url, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(user.id, target_id, appeal_type, reason.trim(), evidence_url || null, now).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'appeal', 'api_appeal', result.meta.last_row_id as number, {
      target_id,
      appeal_type
    });

    return new Response(
      JSON.stringify({
        message: 'Appeal submitted successfully',
        appeal_id: result.meta.last_row_id
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error submitting appeal:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to submit appeal', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/appeals - List appeals (moderator) or own appeals (user)
 */
export async function handleListAppeals(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const isModerator = user.role === 'moderator' || user.role === 'admin';

    let query = `
      SELECT
        a.*,
        t.name as target_name,
        t.url as target_url,
        t.state as target_state,
        u.display_name as appellant_name
      FROM api_appeals a
      JOIN targets t ON a.target_id = t.id
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;

    const bindings: any[] = [];

    // Non-moderators can only see their own appeals
    if (!isModerator) {
      query += ' AND a.user_id = ?';
      bindings.push(user.id);
    }

    if (status) {
      query += ' AND a.status = ?';
      bindings.push(status);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    return new Response(
      JSON.stringify({ appeals: result.results || [] }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error listing appeals:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list appeals', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/appeals/:id - Update appeal status (moderator only)
 */
export async function handleUpdateAppeal(
  appealId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireModerator(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const moderator = userResult as User;

    const id = parseInt(appealId, 10);
    const { status, admin_response, resolution_notes } = await request.json() as {
      status: AppealStatus;
      admin_response?: string;
      resolution_notes?: string;
    };

    if (!VALID_APPEAL_STATUSES.includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status', valid_statuses: VALID_APPEAL_STATUSES }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check appeal exists
    const appeal = await env.DB.prepare('SELECT id, target_id FROM api_appeals WHERE id = ?')
      .bind(id).first<{ id: number; target_id: number }>();

    if (!appeal) {
      return new Response(
        JSON.stringify({ error: 'Appeal not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `UPDATE api_appeals SET
        status = ?,
        admin_response = ?,
        resolution_notes = ?,
        reviewed_at = ?,
        reviewed_by = ?
      WHERE id = ?`
    ).bind(status, admin_response || null, resolution_notes || null, now, moderator.id, id).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, moderator.id, ipAddress, 'moderation_action', 'api_appeal', id, {
      action: 'appeal_review',
      status
    });

    return new Response(
      JSON.stringify({ message: 'Appeal updated' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error updating appeal:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update appeal', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/government/dashboard - Government user dashboard
 */
export async function handleGovernmentDashboard(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    if (user.role !== 'government' && user.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Government access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Get user's departments
    const departments = await env.DB.prepare(
      `SELECT d.*, gud.role as user_role
       FROM government_departments d
       JOIN government_user_departments gud ON d.id = gud.department_id
       WHERE gud.user_id = ?`
    ).bind(user.id).all();

    // Get pending issues needing response (for government's state/department)
    const pendingIssues = await env.DB.prepare(
      `SELECT
        i.id, i.title, i.severity, i.created_at,
        t.name as target_name, t.state
      FROM issues i
      JOIN targets t ON i.target_id = t.id
      WHERE i.status IN ('open', 'investigating')
        AND i.government_response IS NULL
      ORDER BY
        CASE i.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        i.upvotes DESC
      LIMIT 10`
    ).all();

    // Get user's recent responses
    const recentResponses = await env.DB.prepare(
      `SELECT
        i.id, i.title, i.government_response, i.government_responded_at,
        t.name as target_name
      FROM issues i
      JOIN targets t ON i.target_id = t.id
      WHERE i.government_responded_by = ?
      ORDER BY i.government_responded_at DESC
      LIMIT 5`
    ).bind(user.id).all();

    // Get user's appeals
    const userAppeals = await env.DB.prepare(
      `SELECT
        a.id, a.appeal_type, a.status, a.created_at,
        t.name as target_name
      FROM api_appeals a
      JOIN targets t ON a.target_id = t.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
      LIMIT 5`
    ).bind(user.id).all();

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          display_name: user.display_name,
          email: user.email,
          role: user.role
        },
        departments: departments.results || [],
        pending_issues: pendingIssues.results || [],
        recent_responses: recentResponses.results || [],
        appeals: userAppeals.results || []
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting government dashboard:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load dashboard', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
