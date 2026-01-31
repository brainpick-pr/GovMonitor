/**
 * Issue Reporting Handlers
 * Endpoints for reporting and managing issues with government portals
 */

import type { Env, Issue, IssueComment, CreateIssuePayload, CreateIssueCommentPayload, User, IssueCategory, IssueSeverity, IssueStatus } from '../types';
import { requireUser, requireModerator, logUserActivity, getClientIP, validateSession } from './oauth';

// Valid issue categories and severities
const VALID_CATEGORIES: IssueCategory[] = [
  'downtime', 'slow_performance', 'broken_functionality',
  'security_concern', 'accessibility', 'data_issue', 'other'
];

const VALID_SEVERITIES: IssueSeverity[] = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES: IssueStatus[] = ['open', 'investigating', 'resolved', 'wont_fix', 'duplicate'];

/**
 * GET /api/issues - List issues with filtering
 */
export async function handleListIssues(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const targetId = url.searchParams.get('target_id');
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const severity = url.searchParams.get('severity');
    const state = url.searchParams.get('state');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const sortBy = url.searchParams.get('sort') || 'created_at'; // created_at, upvotes

    let query = `
      SELECT
        i.*,
        t.name as target_name,
        t.url as target_url,
        t.state as target_state,
        u.display_name as reporter_name,
        u.avatar_url as reporter_avatar,
        (SELECT COUNT(*) FROM issue_comments WHERE issue_id = i.id) as comment_count
      FROM issues i
      JOIN targets t ON i.target_id = t.id
      JOIN users u ON i.user_id = u.id
      WHERE 1=1
    `;

    const bindings: any[] = [];

    if (targetId) {
      query += ' AND i.target_id = ?';
      bindings.push(parseInt(targetId, 10));
    }

    if (status) {
      query += ' AND i.status = ?';
      bindings.push(status);
    }

    if (category) {
      query += ' AND i.category = ?';
      bindings.push(category);
    }

    if (severity) {
      query += ' AND i.severity = ?';
      bindings.push(severity);
    }

    if (state) {
      query += ' AND t.state = ?';
      bindings.push(state);
    }

    if (sortBy === 'upvotes') {
      query += ' ORDER BY i.upvotes DESC, i.created_at DESC';
    } else {
      query += ' ORDER BY i.created_at DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM issues i
      JOIN targets t ON i.target_id = t.id
      WHERE 1=1
    `;
    const countBindings: any[] = [];

    if (targetId) {
      countQuery += ' AND i.target_id = ?';
      countBindings.push(parseInt(targetId, 10));
    }
    if (status) {
      countQuery += ' AND i.status = ?';
      countBindings.push(status);
    }
    if (category) {
      countQuery += ' AND i.category = ?';
      countBindings.push(category);
    }
    if (severity) {
      countQuery += ' AND i.severity = ?';
      countBindings.push(severity);
    }
    if (state) {
      countQuery += ' AND t.state = ?';
      countBindings.push(state);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countBindings).first<{ count: number }>();

    return new Response(
      JSON.stringify({
        issues: result.results || [],
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
    console.error('Error listing issues:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list issues', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/issues/:id - Get issue details
 */
export async function handleGetIssue(
  issueId: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const id = parseInt(issueId, 10);

    const issue = await env.DB.prepare(
      `SELECT
        i.*,
        t.name as target_name,
        t.url as target_url,
        t.hostname as target_hostname,
        t.state as target_state,
        u.display_name as reporter_name,
        u.avatar_url as reporter_avatar,
        u.reputation_score as reporter_reputation,
        gr.display_name as government_responder_name,
        rv.display_name as resolver_name
      FROM issues i
      JOIN targets t ON i.target_id = t.id
      JOIN users u ON i.user_id = u.id
      LEFT JOIN users gr ON i.government_responded_by = gr.id
      LEFT JOIN users rv ON i.resolved_by = rv.id
      WHERE i.id = ?`
    ).bind(id).first();

    if (!issue) {
      return new Response(
        JSON.stringify({ error: 'Issue not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get comments
    const comments = await env.DB.prepare(
      `SELECT
        c.*,
        u.display_name as author_name,
        u.avatar_url as author_avatar,
        u.role as author_role
      FROM issue_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.issue_id = ?
      ORDER BY c.created_at ASC`
    ).bind(id).all();

    // Get screenshots
    const screenshots = await env.DB.prepare(
      'SELECT * FROM issue_screenshots WHERE issue_id = ? ORDER BY created_at'
    ).bind(id).all();

    return new Response(
      JSON.stringify({
        issue,
        comments: comments.results || [],
        screenshots: screenshots.results || []
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting issue:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get issue', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/issues - Report a new issue (auth required)
 */
export async function handleCreateIssue(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const payload: CreateIssuePayload = await request.json();

    // Validate required fields
    if (!payload.target_id || !payload.title || !payload.description || !payload.category || !payload.severity) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: target_id, title, description, category, severity' }),
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

    // Validate severity
    if (!VALID_SEVERITIES.includes(payload.severity)) {
      return new Response(
        JSON.stringify({ error: 'Invalid severity', valid_severities: VALID_SEVERITIES }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check target exists
    const target = await env.DB.prepare('SELECT id, name FROM targets WHERE id = ?')
      .bind(payload.target_id).first<{ id: number; name: string }>();

    if (!target) {
      return new Response(
        JSON.stringify({ error: 'Target not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check for duplicate issue (same user, same target, same title in last 24h)
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    const duplicate = await env.DB.prepare(
      'SELECT id FROM issues WHERE user_id = ? AND target_id = ? AND title = ? AND created_at > ?'
    ).bind(user.id, payload.target_id, payload.title, oneDayAgo).first();

    if (duplicate) {
      return new Response(
        JSON.stringify({ error: 'You have already reported a similar issue recently' }),
        { status: 409, headers: corsHeaders }
      );
    }

    // Rate limit: max 10 issues per day
    const recentIssues = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM issues WHERE user_id = ? AND created_at > ?'
    ).bind(user.id, oneDayAgo).first<{ count: number }>();

    if ((recentIssues?.count || 0) >= 10) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. You can report up to 10 issues per day.' }),
        { status: 429, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Create issue
    const result = await env.DB.prepare(
      `INSERT INTO issues (
        target_id, user_id, title, description, category, severity,
        status, upvotes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', 0, ?, ?)`
    ).bind(
      payload.target_id,
      user.id,
      payload.title,
      payload.description,
      payload.category,
      payload.severity,
      now,
      now
    ).run();

    if (!result.success) {
      throw new Error('Failed to create issue');
    }

    // Auto-subscribe reporter to issue
    await env.DB.prepare(
      'INSERT INTO issue_subscriptions (issue_id, user_id, created_at) VALUES (?, ?, ?)'
    ).bind(result.meta.last_row_id, user.id, now).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'issue_report', 'issue', result.meta.last_row_id as number, {
      target_id: payload.target_id,
      severity: payload.severity
    });

    return new Response(
      JSON.stringify({
        message: 'Issue reported successfully',
        issue_id: result.meta.last_row_id
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error creating issue:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to report issue', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/targets/:id/issues - Get issues for specific target
 */
export async function handleGetTargetIssues(
  targetId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const id = parseInt(targetId, 10);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    let query = `
      SELECT
        i.*,
        u.display_name as reporter_name,
        u.avatar_url as reporter_avatar,
        (SELECT COUNT(*) FROM issue_comments WHERE issue_id = i.id) as comment_count
      FROM issues i
      JOIN users u ON i.user_id = u.id
      WHERE i.target_id = ?
    `;

    const bindings: any[] = [id];

    if (status) {
      query += ' AND i.status = ?';
      bindings.push(status);
    }

    query += ' ORDER BY i.upvotes DESC, i.created_at DESC LIMIT ?';
    bindings.push(limit);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    // Get issue statistics for this target
    const stats = await env.DB.prepare(
      `SELECT
        COUNT(*) as total_issues,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_issues,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_issues
      FROM issues WHERE target_id = ?`
    ).bind(id).first();

    return new Response(
      JSON.stringify({
        issues: result.results || [],
        stats
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting target issues:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get issues', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/issues/:id/comments - Add comment to issue
 */
export async function handleAddComment(
  issueId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const id = parseInt(issueId, 10);
    const { content } = await request.json() as CreateIssueCommentPayload;

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Comment content is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check issue exists
    const issue = await env.DB.prepare('SELECT id FROM issues WHERE id = ?').bind(id).first();
    if (!issue) {
      return new Response(
        JSON.stringify({ error: 'Issue not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const isGovernmentResponse = user.role === 'government' ? 1 : 0;

    // Create comment
    const result = await env.DB.prepare(
      `INSERT INTO issue_comments (issue_id, user_id, content, is_government_response, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, content.trim(), isGovernmentResponse, now, now).run();

    // Update issue updated_at
    await env.DB.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').bind(now, id).run();

    // Auto-subscribe commenter
    await env.DB.prepare(
      'INSERT OR IGNORE INTO issue_subscriptions (issue_id, user_id, created_at) VALUES (?, ?, ?)'
    ).bind(id, user.id, now).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'comment', 'issue', id);

    return new Response(
      JSON.stringify({
        message: 'Comment added',
        comment_id: result.meta.last_row_id
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error adding comment:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to add comment', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/issues/:id/vote - Vote on issue (upvote)
 */
export async function handleVoteIssue(
  issueId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const id = parseInt(issueId, 10);

    // Check issue exists
    const issue = await env.DB.prepare('SELECT id, user_id FROM issues WHERE id = ?')
      .bind(id).first<{ id: number; user_id: number }>();

    if (!issue) {
      return new Response(
        JSON.stringify({ error: 'Issue not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Can't vote on own issue
    if (issue.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot vote on your own issue' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Try to add vote (will fail silently if already voted due to UNIQUE constraint)
    try {
      await env.DB.prepare(
        'INSERT INTO issue_votes (issue_id, user_id, created_at) VALUES (?, ?, ?)'
      ).bind(id, user.id, now).run();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'You have already voted on this issue' }),
        { status: 409, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ message: 'Vote recorded' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error voting on issue:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to vote', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/issues/:id/respond - Add government response (government user only)
 */
export async function handleGovernmentResponse(
  issueId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    // Check if user is government
    if (user.role !== 'government' && user.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only government users can respond officially' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const id = parseInt(issueId, 10);
    const { response } = await request.json() as { response: string };

    if (!response || response.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Response content is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check issue exists
    const issue = await env.DB.prepare('SELECT id FROM issues WHERE id = ?').bind(id).first();
    if (!issue) {
      return new Response(
        JSON.stringify({ error: 'Issue not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Update issue with government response
    await env.DB.prepare(
      `UPDATE issues SET
        government_response = ?,
        government_responded_by = ?,
        government_responded_at = ?,
        updated_at = ?
      WHERE id = ?`
    ).bind(response.trim(), user.id, now, now, id).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'moderation_action', 'issue', id, { action: 'government_response' });

    return new Response(
      JSON.stringify({ message: 'Government response added' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error adding government response:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to add response', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/issues/:id/status - Update issue status (moderator only)
 */
export async function handleUpdateIssueStatus(
  issueId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireModerator(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const moderator = userResult as User;

    const id = parseInt(issueId, 10);
    const { status, resolution_notes } = await request.json() as { status: IssueStatus; resolution_notes?: string };

    if (!VALID_STATUSES.includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status', valid_statuses: VALID_STATUSES }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check issue exists
    const issue = await env.DB.prepare('SELECT id, user_id, status as current_status FROM issues WHERE id = ?')
      .bind(id).first<{ id: number; user_id: number; current_status: string }>();

    if (!issue) {
      return new Response(
        JSON.stringify({ error: 'Issue not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const isResolved = status === 'resolved';

    // Update issue
    await env.DB.prepare(
      `UPDATE issues SET
        status = ?,
        resolved_at = ?,
        resolved_by = ?,
        resolution_notes = ?,
        updated_at = ?
      WHERE id = ?`
    ).bind(
      status,
      isResolved ? now : null,
      isResolved ? moderator.id : null,
      resolution_notes || null,
      now,
      id
    ).run();

    // Award reputation if issue was resolved (5 points to reporter)
    if (isResolved && issue.current_status !== 'resolved') {
      await env.DB.prepare(
        'UPDATE users SET reputation_score = reputation_score + 5, updated_at = ? WHERE id = ?'
      ).bind(now, issue.user_id).run();
    }

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, moderator.id, ipAddress, 'moderation_action', 'issue', id, {
      action: 'status_change',
      old_status: issue.current_status,
      new_status: status
    });

    return new Response(
      JSON.stringify({ message: 'Issue status updated' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error updating issue status:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update status', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/issues/assigned - Get issues assigned to government user for response
 */
export async function handleGetAssignedIssues(
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
        JSON.stringify({ error: 'Only government users can access assigned issues' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const responded = url.searchParams.get('responded'); // 'true' or 'false'

    let query = `
      SELECT
        i.*,
        t.name as target_name,
        t.url as target_url,
        t.state as target_state,
        u.display_name as reporter_name
      FROM issues i
      JOIN targets t ON i.target_id = t.id
      JOIN users u ON i.user_id = u.id
      WHERE i.status IN ('open', 'investigating')
    `;

    const bindings: any[] = [];

    if (responded === 'true') {
      query += ' AND i.government_response IS NOT NULL';
    } else if (responded === 'false') {
      query += ' AND i.government_response IS NULL';
    }

    query += ' ORDER BY i.severity DESC, i.upvotes DESC, i.created_at ASC LIMIT ?';
    bindings.push(limit);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    return new Response(
      JSON.stringify({ issues: result.results || [] }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting assigned issues:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get assigned issues', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
