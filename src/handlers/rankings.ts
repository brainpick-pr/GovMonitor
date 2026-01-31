/**
 * Ranking System Handlers
 * Endpoints for state rankings and methodology
 */

import type { Env, User, StateRanking, RankingPeriod, RankingSuggestion } from '../types';
import { requireUser, requireModerator, logUserActivity, getClientIP } from './oauth';

const VALID_PERIODS: RankingPeriod[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

/**
 * GET /api/rankings - Get current state rankings
 */
export async function handleGetRankings(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const period = (url.searchParams.get('period') || 'monthly') as RankingPeriod;
    const limit = parseInt(url.searchParams.get('limit') || '36', 10); // Default to all states

    if (!VALID_PERIODS.includes(period)) {
      return new Response(
        JSON.stringify({ error: 'Invalid period', valid_periods: VALID_PERIODS }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get latest rankings for the period
    const rankings = await env.DB.prepare(
      `SELECT r.*
       FROM state_rankings r
       INNER JOIN (
         SELECT period, MAX(period_end) as latest_end
         FROM state_rankings
         WHERE period = ?
         GROUP BY period
       ) latest ON r.period = latest.period AND r.period_end = latest.latest_end
       ORDER BY r.rank ASC
       LIMIT ?`
    ).bind(period, limit).all<StateRanking>();

    // Get period info
    const periodInfo = rankings.results && rankings.results.length > 0 ? {
      period,
      period_start: rankings.results[0].period_start,
      period_end: rankings.results[0].period_end,
      total_states: rankings.results.length
    } : null;

    return new Response(
      JSON.stringify({
        rankings: rankings.results || [],
        period_info: periodInfo
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting rankings:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get rankings', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/rankings/state/:state - Get ranking history for a specific state
 */
export async function handleGetStateRankingHistory(
  state: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const period = (url.searchParams.get('period') || 'monthly') as RankingPeriod;
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);

    const history = await env.DB.prepare(
      `SELECT *
       FROM state_rankings
       WHERE state = ? AND period = ?
       ORDER BY period_end DESC
       LIMIT ?`
    ).bind(decodeURIComponent(state), period, limit).all<StateRanking>();

    return new Response(
      JSON.stringify({
        state: decodeURIComponent(state),
        period,
        history: history.results || []
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting state ranking history:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get ranking history', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/rankings/methodology - Get ranking methodology documentation
 */
export async function handleGetMethodology(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const methodology = await env.DB.prepare(
      `SELECT *
       FROM ranking_methodology
       WHERE effective_from <= ?
       ORDER BY version DESC
       LIMIT 1`
    ).bind(Math.floor(Date.now() / 1000)).first();

    if (!methodology) {
      return new Response(
        JSON.stringify({ error: 'Methodology not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify(methodology),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting methodology:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get methodology', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/rankings/suggestions - Submit ranking improvement suggestion
 */
export async function handleSubmitSuggestion(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    const { suggestion, category } = await request.json() as { suggestion: string; category?: string };

    if (!suggestion || suggestion.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Suggestion content is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (suggestion.trim().length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Suggestion too long. Maximum 2000 characters.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const validCategories = ['methodology', 'weights', 'metrics', 'other'];
    const suggestionCategory = category && validCategories.includes(category) ? category : 'other';

    // Rate limit: max 3 suggestions per day
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    const recentSuggestions = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM ranking_suggestions WHERE user_id = ? AND created_at > ?'
    ).bind(user.id, oneDayAgo).first<{ count: number }>();

    if ((recentSuggestions?.count || 0) >= 3) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. You can submit up to 3 suggestions per day.' }),
        { status: 429, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    const result = await env.DB.prepare(
      `INSERT INTO ranking_suggestions (user_id, suggestion, category, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`
    ).bind(user.id, suggestion.trim(), suggestionCategory, now).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'submission', 'ranking_suggestion', result.meta.last_row_id as number);

    return new Response(
      JSON.stringify({
        message: 'Suggestion submitted successfully',
        suggestion_id: result.meta.last_row_id
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error submitting suggestion:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to submit suggestion', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/rankings/suggestions - List ranking suggestions (moderator only)
 */
export async function handleListSuggestions(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireModerator(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let query = `
      SELECT
        s.*,
        u.display_name as submitter_name,
        u.avatar_url as submitter_avatar
      FROM ranking_suggestions s
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;

    const bindings: any[] = [];

    if (status) {
      query += ' AND s.status = ?';
      bindings.push(status);
    }

    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...bindings).all();

    return new Response(
      JSON.stringify({ suggestions: result.results || [] }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error listing suggestions:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list suggestions', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/rankings/suggestions/:id - Update suggestion status (moderator only)
 */
export async function handleUpdateSuggestion(
  suggestionId: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const userResult = await requireModerator(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const moderator = userResult as User;

    const id = parseInt(suggestionId, 10);
    const { status, admin_response } = await request.json() as { status: string; admin_response?: string };

    const validStatuses = ['pending', 'accepted', 'rejected', 'implemented'];
    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status', valid_statuses: validStatuses }),
        { status: 400, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      `UPDATE ranking_suggestions SET
        status = ?,
        admin_response = ?,
        reviewed_at = ?,
        reviewed_by = ?
      WHERE id = ?`
    ).bind(status, admin_response || null, now, moderator.id, id).run();

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, moderator.id, ipAddress, 'moderation_action', 'ranking_suggestion', id, {
      action: 'review',
      status
    });

    return new Response(
      JSON.stringify({ message: 'Suggestion updated' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error updating suggestion:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update suggestion', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/rankings/statistics - Get overall ranking statistics
 */
export async function handleGetRankingStatistics(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Get latest monthly stats
    const latestRankings = await env.DB.prepare(
      `SELECT
        AVG(uptime_percentage) as avg_national_uptime,
        AVG(avg_latency_ms) as avg_national_latency,
        AVG(issue_resolution_rate) as avg_resolution_rate,
        SUM(total_portals) as total_monitored_portals,
        COUNT(DISTINCT state) as states_ranked,
        MAX(uptime_percentage) as best_uptime,
        MIN(uptime_percentage) as worst_uptime
      FROM current_state_rankings
      WHERE period = 'monthly'`
    ).first();

    // Get top 5 states
    const topStates = await env.DB.prepare(
      `SELECT state, rank, score, uptime_percentage
       FROM current_state_rankings
       WHERE period = 'monthly'
       ORDER BY rank ASC
       LIMIT 5`
    ).all();

    // Get most improved states
    const mostImproved = await env.DB.prepare(
      `SELECT state, rank_change, rank, previous_rank
       FROM current_state_rankings
       WHERE period = 'monthly' AND rank_change < 0
       ORDER BY rank_change ASC
       LIMIT 5`
    ).all();

    return new Response(
      JSON.stringify({
        national_averages: latestRankings,
        top_states: topStates.results || [],
        most_improved: mostImproved.results || []
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error getting ranking statistics:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get statistics', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
