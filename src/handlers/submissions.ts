/**
 * Community Submission Handlers
 * Endpoints for submitting and managing website submissions
 */

import type { Env, Submission, CreateSubmissionPayload, User, PortalCategory } from '../types';
import { validateSession, requireUser, requireModerator, logUserActivity, getClientIP } from './oauth';
import { INDIAN_STATES } from '../constants';

// Valid categories for submissions
const VALID_CATEGORIES: PortalCategory[] = [
  'central', 'identity', 'financial', 'transport', 'utilities',
  'health', 'business', 'passport', 'transparency', 'education',
  'tender', 'other'
];

/**
 * GET /api/submissions - List submissions with filtering
 */
export async function handleListSubmissions(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // pending, approved, rejected
    const category = url.searchParams.get('category');
    const state = url.searchParams.get('state');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const sortBy = url.searchParams.get('sort') || 'created_at'; // created_at, vote_score

    // Build query
    let query = `
      SELECT
        s.*,
        u.display_name as submitter_name,
        u.avatar_url as submitter_avatar,
        COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0) as upvotes,
        COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0) as downvotes,
        COALESCE(SUM(v.vote), 0) as vote_score
      FROM submissions s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN submission_votes v ON s.id = v.submission_id
      WHERE 1=1
    `;

    const bindings: any[] = [];

    if (status) {
      query += ' AND s.status = ?';
      bindings.push(status);
    }

    if (category) {
      query += ' AND s.category = ?';
      bindings.push(category);
    }

    if (state) {
      query += ' AND s.state = ?';
      bindings.push(state);
    }

    query += ' GROUP BY s.id';

    if (sortBy === 'vote_score') {
      query += ' ORDER BY vote_score DESC, s.created_at DESC';
    } else {
      query += ' ORDER BY s.created_at DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM submissions s WHERE 1=1`;
    const countBindings: any[] = [];

    if (status) {
      countQuery += ' AND s.status = ?';
      countBindings.push(status);
    }
    if (category) {
      countQuery += ' AND s.category = ?';
      countBindings.push(category);
    }
    if (state) {
      countQuery += ' AND s.state = ?';
      countBindings.push(state);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countBindings).first<{ count: number }>();

    return new Response(
      JSON.stringify({
        submissions: result.results || [],
        pagination: {
          total: countResult?.count || 0,
          limit,
          offset,
          has_more: (countResult?.count || 0) > offset + limit
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error listing submissions:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list submissions', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/submissions - Submit a new website (auth required)
 */
export async function handleCreateSubmission(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Require authenticated user
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const payload: CreateSubmissionPayload = await request.json();

    // Validate required fields
    if (!payload.name || !payload.url || !payload.category || !payload.justification) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, url, category, justification' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate URL
    let hostname: string;
    try {
      const urlObj = new URL(payload.url);
      hostname = urlObj.hostname;

      // Check for government domain
      if (!hostname.endsWith('.gov.in') && !hostname.endsWith('.nic.in') && !hostname.endsWith('.ac.in')) {
        return new Response(
          JSON.stringify({ error: 'URL must be a government website (.gov.in, .nic.in, or .ac.in domain)' }),
          { status: 400, headers: corsHeaders }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(payload.category)) {
      return new Response(
        JSON.stringify({ error: 'Invalid category', valid_categories: VALID_CATEGORIES }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate state if provided
    if (payload.state && !INDIAN_STATES.includes(payload.state as any) && payload.state !== 'Central') {
      return new Response(
        JSON.stringify({ error: 'Invalid state' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check for duplicate URL (in submissions or targets)
    const existingSubmission = await env.DB.prepare(
      'SELECT id FROM submissions WHERE hostname = ? AND status != ?'
    ).bind(hostname, 'rejected').first();

    if (existingSubmission) {
      return new Response(
        JSON.stringify({ error: 'This website has already been submitted' }),
        { status: 409, headers: corsHeaders }
      );
    }

    const existingTarget = await env.DB.prepare(
      'SELECT id FROM targets WHERE hostname = ?'
    ).bind(hostname).first();

    if (existingTarget) {
      return new Response(
        JSON.stringify({ error: 'This website is already being monitored' }),
        { status: 409, headers: corsHeaders }
      );
    }

    // Check user submission rate limit (max 5 pending per day)
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    const recentSubmissions = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND created_at > ? AND status = ?'
    ).bind(user.id, oneDayAgo, 'pending').first<{ count: number }>();

    if ((recentSubmissions?.count || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. You can submit up to 5 websites per day.' }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Create submission
    const now = Math.floor(Date.now() / 1000);
    const result = await env.DB.prepare(
      `INSERT INTO submissions (
        user_id, name, url, hostname, state, category, justification,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).bind(
      user.id,
      payload.name,
      payload.url,
      hostname,
      payload.state || null,
      payload.category,
      payload.justification,
      now,
      now
    ).run();

    if (!result.success) {
      throw new Error('Failed to create submission');
    }

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'submission', 'submission', result.meta.last_row_id as number);

    return new Response(
      JSON.stringify({
        message: 'Submission created successfully',
        submission_id: result.meta.last_row_id
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error creating submission:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create submission', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/submissions/mine - Get current user's submissions
 */
export async function handleGetMySubmissions(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const result = await env.DB.prepare(
      `SELECT s.*,
        COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0) as upvotes,
        COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0) as downvotes
      FROM submissions s
      LEFT JOIN submission_votes v ON s.id = v.submission_id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?`
    ).bind(user.id, limit, offset).all();

    return new Response(
      JSON.stringify({ submissions: result.results || [] }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting user submissions:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get submissions', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/submissions/guidelines - Get submission guidelines
 */
export async function handleGetGuidelines(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const guidelines = await env.DB.prepare(
      'SELECT * FROM submission_guidelines ORDER BY version DESC LIMIT 1'
    ).first();

    if (!guidelines) {
      return new Response(
        JSON.stringify({ error: 'Guidelines not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify(guidelines),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting guidelines:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get guidelines', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/submissions/:id/vote - Vote on a submission
 */
export async function handleVoteSubmission(
  submissionId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const { vote } = await request.json() as { vote: number };

    if (vote !== 1 && vote !== -1) {
      return new Response(
        JSON.stringify({ error: 'Vote must be 1 (upvote) or -1 (downvote)' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const id = parseInt(submissionId, 10);

    // Check submission exists and is pending
    const submission = await env.DB.prepare(
      'SELECT id, user_id, status FROM submissions WHERE id = ?'
    ).bind(id).first<{ id: number; user_id: number; status: string }>();

    if (!submission) {
      return new Response(
        JSON.stringify({ error: 'Submission not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (submission.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Cannot vote on non-pending submissions' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Can't vote on own submission
    if (submission.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot vote on your own submission' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Upsert vote
    await env.DB.prepare(
      `INSERT INTO submission_votes (submission_id, user_id, vote, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (submission_id, user_id) DO UPDATE SET vote = ?, created_at = ?`
    ).bind(id, user.id, vote, now, vote, now).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'vote', 'submission', id, { vote });

    return new Response(
      JSON.stringify({ message: 'Vote recorded' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error voting on submission:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to vote', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/submissions/:id/approve - Approve a submission (moderator only)
 */
export async function handleApproveSubmission(
  submissionId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireModerator(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const moderator = userResult as User;

    const id = parseInt(submissionId, 10);
    const { review_notes } = await request.json() as { review_notes?: string };

    // Get submission
    const submission = await env.DB.prepare(
      'SELECT * FROM submissions WHERE id = ? AND status = ?'
    ).bind(id, 'pending').first<Submission>();

    if (!submission) {
      return new Response(
        JSON.stringify({ error: 'Submission not found or already reviewed' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Create target from submission
    const targetResult = await env.DB.prepare(
      `INSERT INTO targets (
        name, url, hostname, state, interval_min, enabled,
        check_mode, expected_status, category, description
      ) VALUES (?, ?, ?, ?, 15, 1, 'website', 200, ?, ?)`
    ).bind(
      submission.name,
      submission.url,
      submission.hostname,
      submission.state,
      submission.category,
      submission.justification
    ).run();

    if (!targetResult.success) {
      throw new Error('Failed to create target');
    }

    // Update submission status
    await env.DB.prepare(
      `UPDATE submissions SET
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = ?,
        review_notes = ?,
        target_id = ?,
        updated_at = ?
      WHERE id = ?`
    ).bind(moderator.id, now, review_notes || null, targetResult.meta.last_row_id, now, id).run();

    // Award reputation to submitter (10 points for approved submission)
    await env.DB.prepare(
      'UPDATE users SET reputation_score = reputation_score + 10, updated_at = ? WHERE id = ?'
    ).bind(now, submission.user_id).run();

    // Log moderator action
    const ipAddress = getClientIP(request);
    await logUserActivity(env, moderator.id, ipAddress, 'moderation_action', 'submission', id, {
      action: 'approve',
      target_id: targetResult.meta.last_row_id
    });

    return new Response(
      JSON.stringify({
        message: 'Submission approved',
        target_id: targetResult.meta.last_row_id
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error approving submission:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to approve submission', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/submissions/:id/reject - Reject a submission (moderator only)
 */
export async function handleRejectSubmission(
  submissionId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireModerator(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const moderator = userResult as User;

    const id = parseInt(submissionId, 10);
    const { review_notes } = await request.json() as { review_notes: string };

    if (!review_notes) {
      return new Response(
        JSON.stringify({ error: 'Rejection requires review notes explaining the reason' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check submission exists and is pending
    const submission = await env.DB.prepare(
      'SELECT id, user_id FROM submissions WHERE id = ? AND status = ?'
    ).bind(id, 'pending').first<{ id: number; user_id: number }>();

    if (!submission) {
      return new Response(
        JSON.stringify({ error: 'Submission not found or already reviewed' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Update submission status
    await env.DB.prepare(
      `UPDATE submissions SET
        status = 'rejected',
        reviewed_by = ?,
        reviewed_at = ?,
        review_notes = ?,
        updated_at = ?
      WHERE id = ?`
    ).bind(moderator.id, now, review_notes, now, id).run();

    // Log moderator action
    const ipAddress = getClientIP(request);
    await logUserActivity(env, moderator.id, ipAddress, 'moderation_action', 'submission', id, {
      action: 'reject',
      reason: review_notes
    });

    return new Response(
      JSON.stringify({ message: 'Submission rejected' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error rejecting submission:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to reject submission', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/submissions/moderation-queue - Get moderation queue (moderator only)
 */
export async function handleGetModerationQueue(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireModerator(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const result = await env.DB.prepare(
      `SELECT
        s.*,
        u.display_name as submitter_name,
        u.avatar_url as submitter_avatar,
        u.reputation_score as submitter_reputation,
        COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0) as upvotes,
        COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0) as downvotes,
        COALESCE(SUM(v.vote), 0) as vote_score
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN submission_votes v ON s.id = v.submission_id
      WHERE s.status = 'pending'
      GROUP BY s.id
      ORDER BY vote_score DESC, s.created_at ASC
      LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    // Get total pending count
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM submissions WHERE status = ?'
    ).bind('pending').first<{ count: number }>();

    return new Response(
      JSON.stringify({
        queue: result.results || [],
        total_pending: countResult?.count || 0
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting moderation queue:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get moderation queue', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
